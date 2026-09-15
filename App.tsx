import React, { useState, useCallback, useEffect, useRef } from 'react';
import SmartBoard from './components/Board';
import Chat from './components/Chat';
import SettingsModal from './components/SettingsModal';
import VisualizeTextModal from './components/VisualizeTextModal';
import PdfWorkspace from './components/PdfWorkspace';
import Onboarding from './components/Onboarding';
import SmartOnboarding from './components/SmartOnboarding';
import HomeScreen from './components/HomeScreen';
import BottomToolbar from './components/BottomToolbar';
import AISheet from './components/AISheet';
import SlideRail from './components/SlideRail';
import TopBar from './components/TopBar';
import { TeacherPersona, ToolType, ElementData, LessonDetail, ToolbarPosition, ChatMessage, KnowledgeDoc, LessonMode, TeachingMode, BoardMode, BoardTheme, aiLangOf } from './types';
import AtlasPanel from './components/AtlasPanel';
import SmartLabPanel from './components/SmartLabPanel';
import StudentPickerModal from './components/StudentPickerModal';
import GeometryToolsOverlay from './components/GeometryToolsModal';
import ScientificCalcModal from './components/ScientificCalcModal';
import { PIN_BY_ID } from './data/atlas';
import { ElementInfo, ELEMENT_BY_SYMBOL, ELEMENT_BY_NUMBER } from './data/periodic';
import { defaultInk, THEME_LIST } from './data/themes';
import type { SlideData } from './types';
import { speakText, cancelSpeech, setTtsMode } from './services/tts';
import { generateImageWithPollinations } from './services/geminiService';
import { generateLesson } from './services/ai/assistant';
import { useNodesState, useEdgesState, addEdge, useReactFlow, ReactFlowProvider } from 'reactflow';

import type { Connection, Edge, Node } from 'reactflow';

type Slide = SlideData<Node<ElementData>, Edge>;

const THEME_IDS = THEME_LIST.map(t => t.id);

const AppContent: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition, getNodes } = useReactFlow();

  // App State
  const [activeTool, setActiveTool] = useState<ToolType>('pointer');
  const [view, setView] = useState<'home' | 'language-select' | 'board'>('home');
  const [settings, setSettings] = useState<TeacherPersona>({ name: 'Smart Tutor', language: 'English', aiLanguage: 'English', subject: 'General Knowledge', personality: 'Encouraging', voice: 'female', ttsMode: 'gemini' });
  const settingsHydrated = useRef(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('smartboard_settings');
      if (saved) setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
    } catch (e) { console.warn('Settings restore failed', e); }
    settingsHydrated.current = true;
  }, []);
  useEffect(() => {
    if (!settingsHydrated.current) return;
    try { localStorage.setItem('smartboard_settings', JSON.stringify(settings)); }
    catch (e) { console.warn('Settings save failed', e); }
  }, [settings]);
  const isAr = settings.language.toLowerCase().startsWith('ar');
  const aiLang = aiLangOf(settings); // Language used by the AI Teacher (may differ from UI language)
  const aiIsAr = aiLang.toLowerCase().startsWith('ar');
  const [isMuted, setIsMuted] = useState(false);
  useEffect(() => { setTtsMode(settings.ttsMode || 'gemini'); }, [settings.ttsMode]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVisualizeModalOpen, setIsVisualizeModalOpen] = useState(false);
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Setup Screen State
  const [customSubjects, setCustomSubjects] = useState<string[]>(['Mathematics', 'Physics', 'History', 'Biology', 'Literature', 'Programming']);
  const [newSubjectInput, setNewSubjectInput] = useState('');

  // AI & Chat State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [lessonMode, setLessonMode] = useState<LessonMode>('full-lesson');
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('smartboard_knowledge_docs');
      if (saved) setKnowledgeDocs(JSON.parse(saved));
    } catch (e) { console.warn('Knowledge restore failed', e); }
  }, []);
  useEffect(() => {
    try { localStorage.setItem('smartboard_knowledge_docs', JSON.stringify(knowledgeDocs)); }
    catch (e) { console.warn('Knowledge save failed', e); }
  }, [knowledgeDocs]);
  const [chatPrefill, setChatPrefill] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Welcome! I am your visual teaching assistant. What would you like to learn today?', timestamp: Date.now() }
  ]);

  // New Features State
  const [lessonDetail, setLessonDetail] = useState<LessonDetail>('brief');
  const [toolbarPosition, setToolbarPosition] = useState<ToolbarPosition>('top');
  const [isToolbarHidden, setIsToolbarHidden] = useState(false);
  
  // Pen Options
  const [penColor, setPenColor] = useState('#000000');
  const [penSize, setPenSize] = useState(6);

  // Board theme + shape + classroom panels
  const [boardTheme, setBoardTheme] = useState<BoardTheme>('white');
  const [activeShape, setActiveShape] = useState('rectangle');
  const [isAtlasOpen, setIsAtlasOpen] = useState(false);
  const [isLabOpen, setIsLabOpen] = useState(false);
  const [isWheelOpen, setIsWheelOpen] = useState(false);
  const [isGeometryOpen, setIsGeometryOpen] = useState(false);
  const [isCalcOpen, setIsCalcOpen] = useState(false);

  // Undo/Redo stacks
  const [history, setHistory] = useState<Array<{ nodes: Node<ElementData>[]; edges: Edge[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyLock = useRef(false);
  const lastNodes = useRef<Node<ElementData>[]>([]);
  const lastEdges = useRef<Edge[]>([]);

  // Slides / Board mode
  const [boardMode, setBoardMode] = useState<BoardMode>('infinite');
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const slideSyncLock = useRef(false);
  const boardHydrated = useRef(false);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('smartboard_board_snapshot');
      if (saved) {
        const snapshot = JSON.parse(saved);
        if (Array.isArray(snapshot.nodes)) setNodes(snapshot.nodes);
        if (Array.isArray(snapshot.edges)) setEdges(snapshot.edges);
      }
    } catch (e) { console.warn('Offline board restore failed', e); }
    boardHydrated.current = true;
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (!boardHydrated.current) return;
    try { localStorage.setItem('smartboard_board_snapshot', JSON.stringify({ nodes, edges, savedAt: Date.now() })); }
    catch (e) { console.warn('Offline board save failed', e); }
  }, [nodes, edges]);

  // Snapshot board state for undo/redo
  useEffect(() => {
    if (historyLock.current) return;
    // Skip the very first run and no-change updates
    if (lastNodes.current.length === 0 && lastEdges.current.length === 0) {
      lastNodes.current = nodes;
      lastEdges.current = edges;
      return;
    }
    const same = JSON.stringify(lastNodes.current) === JSON.stringify(nodes) && JSON.stringify(lastEdges.current) === JSON.stringify(edges);
    if (same) return;
    lastNodes.current = nodes;
    lastEdges.current = edges;
    setHistory((prev) => {
      const next = [...prev.slice(0, historyIndex + 1), { nodes, edges }];
      return next.slice(-50);
    });
    setHistoryIndex((i) => Math.min(i + 1, 49));
  }, [nodes, edges, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex < 0) return;
    historyLock.current = true;
    const target = history[historyIndex];
    setNodes(target.nodes);
    setEdges(target.edges);
    setHistoryIndex((i) => i - 1);
    setTimeout(() => { historyLock.current = false; }, 0);
  }, [historyIndex, history, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    const next = historyIndex + 1;
    if (next >= history.length) return;
    historyLock.current = true;
    const target = history[next];
    setNodes(target.nodes);
    setEdges(target.edges);
    setHistoryIndex(next);
    setTimeout(() => { historyLock.current = false; }, 0);
  }, [historyIndex, history, setNodes, setEdges]);
  
  // Set language and direction on root element
  useEffect(() => {
    const lang = settings.language.toLowerCase();
    if (lang.startsWith('ar')) {
        document.documentElement.lang = 'ar';
        document.documentElement.dir = 'rtl';
    } else {
        document.documentElement.lang = lang;
        document.documentElement.dir = 'ltr';
    }
  }, [settings.language]);

  // Load board preferences (theme, shape) from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('smartboard_prefs');
      if (saved) {
        const prefs = JSON.parse(saved);
        if (THEME_IDS.includes(prefs.theme)) setBoardTheme(prefs.theme);
        if (typeof prefs.shape === 'string') {
          const known = ['rectangle','ellipse','circle','triangle','diamond','hexagon','line','arrow'];
          if (known.includes(prefs.shape)) setActiveShape(prefs.shape);
        }
        if (typeof prefs.penColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(prefs.penColor)) setPenColor(prefs.penColor);
        if (typeof prefs.penSize === 'number' && prefs.penSize >= 2 && prefs.penSize <= 24) setPenSize(prefs.penSize);
      }
    } catch (e) { console.error('Failed to load board prefs', e); }
  }, []);

  // Persist board preferences
  useEffect(() => {
    try { localStorage.setItem('smartboard_prefs', JSON.stringify({ theme: boardTheme, shape: activeShape, penColor, penSize })); }
    catch (e) { /* ignore */ }
  }, [boardTheme, activeShape, penColor, penSize]);

  // Load Custom Subjects from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('smartboard_subjects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCustomSubjects(prev => Array.from(new Set([...prev, ...parsed])));
      } catch (e) {
        console.error("Failed to load custom subjects", e);
      }
    }
  }, []);

  const handleAddSubject = () => {
    if (newSubjectInput.trim()) {
      const updatedSubjects = [...customSubjects, newSubjectInput.trim()];
      // Remove duplicates
      const uniqueSubjects = Array.from(new Set(updatedSubjects));
      setCustomSubjects(uniqueSubjects);
      setSettings(s => ({ ...s, subject: newSubjectInput.trim() }));
      localStorage.setItem('smartboard_subjects', JSON.stringify(uniqueSubjects));
      setNewSubjectInput('');
    }
  };

  // --- Core Handlers ---
  const onConnect = useCallback((params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)), [setEdges]);
  const handleDeleteNode = useCallback((id: string) => { setNodes((nds) => nds.filter((n) => n.id !== id)); setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id)); }, [setNodes, setEdges]);
  const handleEditNode = useCallback((id: string, newData: Partial<ElementData>) => {
      setNodes((nds) => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...newData } } : n));
  }, [setNodes]);
  const onAddSketch = useCallback((sketchNode: Node) => setNodes((nds) => [...nds, sketchNode]), [setNodes]);
  const handleClearBoard = useCallback(() => {
    if (window.confirm("Are you sure you want to clear the entire board? This action cannot be undone.")) {
      setNodes([]);
      setEdges([]);
    }
  }, [setNodes, setEdges]);

  // --- Slides / Board Mode ---
  const currentSlide = slides.length > 0 && boardMode === 'slides'
    ? slides[Math.min(Math.max(currentSlideIndex, 0), slides.length - 1)]
    : undefined;

  // When in slides mode, edit ops should target the active slide's stored content.
  const switchBoardMode = useCallback((mode: BoardMode) => {
    if (mode === boardMode) return;
    if (mode === 'slides') {
      // Seed slide 0 from current board if no slides yet.
      setSlides(prev => {
        if (prev.length > 0) return prev;
        return [{
          id: 'slide-' + Date.now(),
          name: 'الشريحة 1 / Slide 1',
          nodes: [...nodes],
          edges: [...edges],
        }];
      });
      setCurrentSlideIndex(0);
    } else {
      // Going back to infinite
    }
    setBoardMode(mode);
  }, [boardMode, nodes, edges]);

  // Load slide content when switching slides in slides mode.
  const loadSlide = useCallback((index: number) => {
    if (index < 0 || index >= slides.length) return;
    const target = slides[index];
    slideSyncLock.current = true;
    setNodes(target.nodes);
    setEdges(target.edges);
    setCurrentSlideIndex(index);
    setHistory([]);
    setHistoryIndex(-1);
    setTimeout(() => { slideSyncLock.current = false; }, 0);
  }, [slides, setNodes, setEdges]);

  const addSlide = useCallback(() => {
    const next: Slide[] = [...slides, {
      id: 'slide-' + Date.now(),
      name: `الشريحة ${slides.length + 1} / Slide ${slides.length + 1}`,
      nodes: [],
      edges: [],
    }];
    setSlides(next);
    slideSyncLock.current = true;
    setNodes([]);
    setEdges([]);
    setCurrentSlideIndex(next.length - 1);
    setHistory([]);
    setHistoryIndex(-1);
    setTimeout(() => { slideSyncLock.current = false; }, 0);
  }, [slides, setNodes, setEdges]);

  const deleteSlide = useCallback((index: number) => {
    if (slides.length <= 1) {
      alert(isAr ? 'يبقى على الأقل شريحة واحدة' : 'Keep at least one slide');
      return;
    }
    const next = slides.filter((_, i) => i !== index);
    setSlides(next);
    if (index === currentSlideIndex) {
      const targetIndex = Math.min(index, next.length - 1);
      const target = next[targetIndex];
      slideSyncLock.current = true;
      setNodes(target.nodes);
      setEdges(target.edges);
      setCurrentSlideIndex(targetIndex);
      setHistory([]);
      setHistoryIndex(-1);
      setTimeout(() => { slideSyncLock.current = false; }, 0);
    } else if (index < currentSlideIndex) {
      setCurrentSlideIndex(i => i - 1);
    }
  }, [slides, currentSlideIndex, setNodes, setEdges, isAr]);


  // Persist live board edits into the active slide while in slides mode.
  useEffect(() => {
    if (boardMode !== 'slides' || slideSyncLock.current) return;
    if (slides.length === 0) return;
    const index = Math.min(Math.max(currentSlideIndex, 0), slides.length - 1);
    setSlides(prev => {
      const cur = prev[index];
      if (!cur) return prev;
      return prev.map((s, i) =>
        i === index ? { ...s, nodes: [...nodes], edges: [...edges] } : s
      );
    });
  }, [nodes, edges, boardMode, currentSlideIndex, slides.length]);


  useEffect(() => { 
      (window as any).deleteNode = handleDeleteNode; 
      (window as any).updateNodeData = handleEditNode;
      (window as any).isPointerTool = () => activeTool === 'pointer';
  }, [handleDeleteNode, handleEditNode, activeTool]);
  
  // --- UI Handlers ---
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
      if (['add-note', 'add-text', 'add-shape', 'add-ruler'].includes(activeTool)) {
          const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          const id = `manual-${Date.now()}`;
          const typeMap: { [key: string]: 'note' | 'text' | 'shape' | 'ruler' } = { 
              'add-note': 'note', 
              'add-text': 'text', 
              'add-shape': 'shape',
              'add-ruler': 'ruler',
          };
          // A drag-draw just committed inside Board (avoid double-add)
          const lastDrag: number = (window as any).__lastShapeDragCommit || 0;
          const isShapeDragTick = Date.now() - lastDrag < 600;
          if (activeTool === 'add-shape' && isShapeDragTick) return;

          const dataMap: any = {
            'add-note': { content: 'New Note', color: '#fff740' },
            'add-text': { text: 'Type something...', color: '#333' },
            'add-shape': (() => {
              if (activeShape === 'line' || activeShape === 'arrow') return null;
              return { shapeType: activeShape, color: penColor || '#a8e6cf', width: 150, height: 110 };
            })(),
            'add-ruler': { width: 400, height: 50, rotation: 0 },
          };
          if (activeTool === 'add-shape' && !dataMap['add-shape']) return;
          const newNode: Node = { id, type: typeMap[activeTool], position, data: { id, type: typeMap[activeTool], ...dataMap[activeTool] }};
          setNodes((nds) => [...nds, newNode]);
      }
  }, [activeTool, activeShape, penColor, screenToFlowPosition, setNodes]);
  
  const handleToolCall = useCallback(async (name: string, args: any, originalMessage: string) => {
      const id = args.id;
      if (!id && name !== 'connect') {
        console.error("Tool call received without an ID:", name, args);
        return;
      }

      const defaultPos = { x: 800 + Math.random() * 200 - 100, y: 450 + Math.random() * 100 - 50};
      let textToSpeak = "";

      switch (name) {
        case 'connect':
            setEdges(eds => addEdge({
                id: `edge-${args.from}-${args.to}-${Math.random()}`,
                source: args.from,
                target: args.to,
                type: 'smoothstep',
                animated: true,
                label: args.label,
                style: { strokeWidth: 2 }
            }, eds));
            break;

        case 'addComparison':
            textToSpeak = args.title;
            setNodes(nds => [...nds, { id, type: 'comparison', position: { x: args.x || defaultPos.x, y: args.y || defaultPos.y }, data: { ...args, type: 'comparison' } }]);
            break;

        case 'addMindMap': {
          textToSpeak = args.title;
          const { title, nodes: mindMapNodes, x, y } = args;
          const centerX = x || defaultPos.x;
          const centerY = y || defaultPos.y;
          const rootId = id;

          const newFlowNodes: Node[] = [];
          const newFlowEdges: Edge[] = [];
          
          newFlowNodes.push({
            id: rootId,
            type: 'note',
            position: { x: centerX - 112, y: centerY - 70 },
            data: { id: rootId, type: 'note', content: title, color: '#d1c4e9', style: 'bold' }
          });
          
          if (mindMapNodes && mindMapNodes.length > 0) {
              const childCount = mindMapNodes.length;
              const radius = Math.max(250, childCount * 45);
              const angleStep = (2 * Math.PI) / childCount;

              mindMapNodes.forEach((node: { id: string, label: string }, index: number) => {
                  const angle = index * angleStep - (Math.PI / 2);
                  const nodeX = centerX + radius * Math.cos(angle) - 112; 
                  const nodeY = centerY + radius * Math.sin(angle) - 70;
                  const nodeId = `${rootId}-${node.id}`;
                  newFlowNodes.push({
                      id: nodeId,
                      type: 'note',
                      position: { x: nodeX, y: nodeY },
                      data: { id: nodeId, type: 'note', content: node.label, color: '#c5cae9' }
                  });
                  newFlowEdges.push({
                      id: `edge-${rootId}-${nodeId}`,
                      source: rootId,
                      target: nodeId,
                      type: 'smoothstep',
                      animated: true,
                  });
              });
          }
          
          setNodes(nds => [...nds, ...newFlowNodes]);
          setEdges(eds => [...eds, ...newFlowEdges]);
          break;
        }
        case 'addNote':
            textToSpeak = args.content;
            setNodes(nds => [...nds, { id, type: 'note', position: { x: args.x || defaultPos.x, y: args.y || defaultPos.y }, data: { ...args, type: 'note' } }]);
            break;
        case 'addText':
            textToSpeak = args.text;
            setNodes(nds => [...nds, { id, type: 'text', position: { x: args.x || defaultPos.x, y: args.y || defaultPos.y }, data: { ...args, type: 'text' } }]);
            break;
        case 'update': {
            const patch: Record<string, unknown> = {};
            if (args.text != null) patch.text = args.text;
            if (args.content != null) patch.content = args.content;
            if (args.title != null) patch.title = args.title;
            if (args.color != null) patch.color = args.color;
            if (Array.isArray(args.items)) patch.items = args.items;
            textToSpeak = String(patch.text || patch.content || patch.title || 'Updated');
            setNodes(nds => nds.map(n =>
                n.id === args.id ? { ...n, data: { ...(n.data as any), ...patch } } : n
            ));
            break;
        }
        case 'remove':
            textToSpeak = 'Removed'.split(' ')[0];
            setNodes(nds => nds.filter(n => n.id !== args.id));
            setEdges(eds => eds.filter(e => e.source !== args.id && e.target !== args.id));
            break;
        case 'addImage':
            const imageUrl = generateImageWithPollinations(args.description);
            const imageNode: Node<ElementData> = {
                id,
                type: 'image',
                position: { x: args.x || defaultPos.x, y: args.y || defaultPos.y },
                data: { ...args, type: 'image', url: imageUrl }
            };
            setNodes(nds => [...nds, imageNode]);
            break;
        default: {
             const typeMap: { [key: string]: string } = {
                 'addList': 'list',
                 'addWordArt': 'wordArt',
                 'addShape': 'shape',
                 'addCode': 'code',
                 'addEquation': 'equation',
                 'addTable': 'table',
                 'addSticky': 'sticky',
                 'addArrow': 'arrow',
                 'addLine': 'line',
                 'addDiagram': 'diagram',
                 'addFlowchart': 'flowchart',
                 'addTimeline': 'timeline',
                 'addAtlas': 'atlas',
                 'addPeriodic': 'periodic',
             };
             const nodeType = typeMap[name];
             if(nodeType) {
                const data: Record<string, unknown> = { ...args, type: nodeType };
                if ((name === 'addFlowchart' || name === 'addDiagram') && Array.isArray(args.nodes)) {
                  data.graphNodes = args.nodes;
                }
                if (name === 'addFlowchart' && Array.isArray(args.edges)) {
                  data.graphEdges = args.edges;
                }
                if (name === 'addTimeline') {
                  data.graphNodes = Array.isArray(args.events) ? args.events : args.graphNodes;
                }
                if (name === 'addArrow') {
                  data.points = [
                    { x: args.x1 ?? 0, y: args.y1 ?? 0 },
                    { x: args.x2 ?? 120, y: args.y2 ?? 0 },
                  ];
                }
                if (name === 'addLine') {
                  data.x1 = args.x1 ?? 0; data.y1 = args.y1 ?? 0;
                  data.x2 = args.x2 ?? 120; data.y2 = args.y2 ?? 0;
                }
                if (name === 'addPeriodic') {
                  const el = typeof args.elementNumber === 'number'
                    ? ELEMENT_BY_NUMBER[Number(args.elementNumber)]
                    : ELEMENT_BY_SYMBOL[String(args.symbol || '').trim().replace(/[0-9]/g, '')];
                  data.elementNumber = el ? el.n : 1;
                  data.title = el ? (aiIsAr ? el.ar : el.name) : args.title;
                  data.language = aiLang;
                }
                if (name === 'addAtlas' && args.regionId) {
                  data.regionId = String(args.regionId);
                  if (!data.title) data.title = args.regionId;
                }
                setNodes(nds => [...nds, { id, type: nodeType, position: { x: args.x || defaultPos.x, y: args.y || defaultPos.y }, data }]);
                if (args.content) textToSpeak = args.content;
                if (args.text) textToSpeak = args.text;
                if (args.title) textToSpeak = args.title;
             } else {
                console.warn(`Unhandled tool call: ${name}`);
             }
             break;
        }
      }

      if (textToSpeak) {
        speakText(textToSpeak, aiLang, isMuted);
      }
  }, [setNodes, setEdges, getNodes, settings, aiLang, isMuted]);

  const handlePdfDocAdded = useCallback((doc: KnowledgeDoc) => {
    setKnowledgeDocs(prev => [...prev.filter(d => d.id !== doc.id), doc]);
    (window as any).__smartboardPdfText = doc.text;
    (window as any).__smartboardPdfPages = Array.from({ length: doc.pages || 0 }, (_, i) => i + 1);
  }, []);

  const handlePdfSendPage = useCallback((url: string, title: string, x?: number, y?: number) => {
    const id = 'pdf-' + Date.now();
    setNodes(nds => [...nds, {
      id,
      type: 'image',
      position: { x: x || 200, y: y || 150 },
      data: { id, type: 'image', url, title, width: 540, height: 380 },
    }]);
    setIsPdfOpen(false);
  }, [setNodes]);

  // --- Atlas: place a region map on the board ---
  const handleAtlasPlace = useCallback((regionId: string, title: string, opts?: { pins?: string[]; countries?: string[] }) => {
    const id = 'atlas-' + Date.now();
    setNodes(nds => [...nds, {
      id,
      type: 'atlas',
      position: { x: 200, y: 150 },
      data: {
        id,
        type: 'atlas',
          regionId,
          title,
          selectedCountries: opts?.countries,
        description: opts?.pins?.length
          ? (isAr ? 'المناطق المحددة: ' : 'Selected: ') + opts.pins.map(p => {
              const pin = PIN_BY_ID[p];
              return pin ? (isAr ? pin.nameAr : pin.nameEn) : p;
            }).join('، ')
          : undefined,
      },
    }]);
    setIsAtlasOpen(false);
  }, [setNodes, isAr]);

  // --- Smart Lab: place element card ---
  const handlePlaceElement = useCallback((el: ElementInfo) => {
    const id = 'el-' + Date.now();
    setNodes(nds => [...nds, {
      id,
      type: 'periodic',
      position: { x: 150 + Math.random() * 60, y: 120 + Math.random() * 60 },
      data: {
        id,
        type: 'periodic',
        elementNumber: el.n,
        language: aiLang,
      },
    }]);
  }, [setNodes, aiLang]);

  // --- Smart Lab: place balanced reaction (as an equation node) ---
  const handlePlaceReaction = useCallback((title: string, lhs: string[], rhs: string[]) => {
    const id = 'eq-' + Date.now();
    const lhsStr = lhs.join(' + ');
    const rhsStr = rhs.join(' + ');
    setNodes(nds => [...nds, {
      id,
      type: 'equation',
      position: { x: 180, y: 160 },
      data: {
        id,
        type: 'equation',
        latex: `${lhsStr} \\rightarrow ${rhsStr}`,
        title,
      },
    }]);
    setIsLabOpen(false);
  }, [setNodes]);

  // --- Smart Lab: place a text list ---
  const handlePlaceLabText = useCallback((title: string, items: string[]) => {
    const id = 'list-' + Date.now();
    setNodes(nds => [...nds, {
      id,
      type: 'list',
      position: { x: 160, y: 160 },
      data: { id, type: 'list', title, items, color: '#EDE7F6' },
    }]);
  }, [setNodes]);

const submitPromptToAI = useCallback(async (prompt: string, mode?: LessonMode) => {
    const nextMode = mode || lessonMode;
    cancelSpeech();
    const userMsg: ChatMessage = { role: 'user', text: prompt, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    setIsAiLoading(true);

    try {
      const selected = nodes.filter((n: Node) => (n as any).selected).map((n: Node) => {
        const d = (n.data as any) || {};
        return {
          id: n.id,
          type: String(d?.type || 'note'),
          text: d?.text as string | undefined,
          title: d?.title as string | undefined,
          items: d?.items as string[] | undefined,
          content: d?.content as string | undefined,
          hasMapStrokes: (d?.type === 'atlas' && Array.isArray(d?.sketches) && d.sketches.length > 0) ? d.sketches.length : undefined,
        };
      });

      const allNodes = nodes.map((n: Node) => {
        const d = (n.data as any) || {};
        let out = d.text || d.title || d.content || '';
        if (d.type === 'atlas' && Array.isArray(d.sketches) && d.sketches.length > 0) {
          out = `${out} (map has ${d.sketches.length} teacher annotation stroke(s) drawn on it — be aware when guiding)`;
        }
        return out;
      }).filter(Boolean);
      const boardSummary = allNodes.length > 0 ? allNodes.slice(0, 6).join(' | ') : undefined;

      const pdfText = (window as any).__smartboardPdfText as string | undefined;
      const pdfPages = (window as any).__smartboardPdfPages as number[] | undefined;

      const responseText = await generateLesson({
        mode: nextMode,
        prompt,
        settings,
        detail: lessonDetail,
        knowledgeDocs,
        boardSummary,
        selectedElements: selected.length > 0 ? selected : undefined,
        pdfText,
        pdfPages,
      }, handleToolCall, (speech: string) => speakText(speech, aiLang, isMuted));

      if (responseText) {
        const aiMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
        setChatMessages(prev => [...prev, aiMsg]);
      } else {
        const aiMsg: ChatMessage = { role: 'model', text: aiIsAr ? 'تم.' : 'Done.', timestamp: Date.now() };
        setChatMessages(prev => [...prev, aiMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = { role: 'model', text: `An error occurred: ${err.message || 'Please try again.'}`, timestamp: Date.now() };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsAiLoading(false);
    }
  }, [lessonMode, settings, aiLang, aiIsAr, lessonDetail, knowledgeDocs, nodes, handleToolCall]);

  const handlePdfAsk = useCallback((prompt: string, mode?: string) => {
    setIsPdfOpen(false);
    submitPromptToAI(prompt, (mode as LessonMode) || 'explain');
  }, [submitPromptToAI]);

  const handleModeSelect = useCallback((mode: LessonMode) => {
    setLessonMode(mode);
    const isAr = settings.language.toLowerCase().startsWith('ar');
    const presets: Record<LessonMode, string> = isAr ? {
      'full-lesson': 'حضّر درسًا كاملًا عن:',
      'full-board': 'ابنِ لوحة كاملة حول:',
      'revision': 'راجع ولخّص:',
      'activities': 'أنشئ أنشطة وتمارين حول:',
      'explain': 'اشرح:',
      'simplify': 'بسّط:',
      'expand': 'وسّع شرح:',
      'summarize': 'لخّص:',
      'questions': 'وجّه أسئلة حول:',
      'translate': 'ترجم:',
      'solve': 'حل:',
      'visualize': 'صوّر على السبورة:',
      'arrange': 'أعد ترتيب المحدد:',
      'pdf-to-board': 'انقل صفحة PDF إلى السبورة:',
    } : {
      'full-lesson': 'Prepare a complete lesson on:',
      'full-board': 'Build a full board about:',
      'revision': 'Revise and summarize:',
      'activities': 'Create practice activities on:',
      'explain': 'Explain:',
      'simplify': 'Simplify:',
      'expand': 'Expand on:',
      'summarize': 'Summarize:',
      'questions': 'Ask questions about:',
      'translate': 'Translate:',
      'solve': 'Solve:',
      'visualize': 'Visualize on the board:',
      'arrange': 'Rearrange the selection:',
      'pdf-to-board': 'Place this PDF page on the board:',
    };
    setChatPrefill(presets[mode] || '');
  }, [settings.language]);

  const handleVisualizeText = useCallback((textToVisualize: string) => {
    setIsVisualizeModalOpen(false);
    submitPromptToAI(`Visualize this content on the board: ${textToVisualize}`, 'visualize');
  }, [submitPromptToAI]);


  // --- RENDER LOGIC ---

  useEffect(() => {
    if (view !== 'board') {
      setIsChatOpen(false);
      setIsRunning(false);
      setIsPdfOpen(false);
    }
  }, [view]);

  if (view === 'home') {
    return <HomeScreen language={settings.language} onStart={() => setView('language-select')} />;
  }

  if (view === 'language-select') {
    return (
      <SmartOnboarding
        language={settings.language}
        subject={settings.subject}
        customSubjects={customSubjects}
        newSubjectInput={newSubjectInput}
        onSubjectChange={(s) => setSettings(prev => ({ ...prev, subject: s }))}
        onLanguageChange={(lang) => setSettings(prev => ({ ...prev, language: lang, aiLanguage: lang }))}
        onNewSubjectInput={setNewSubjectInput}
        onAddSubject={handleAddSubject}
        onStart={(data) => {
          if (data.file) handlePdfDocAdded(data.file);
          setSettings(prev => ({ ...prev, name: data.name.trim() || prev.name, mode: data.mode, topic: data.topic.trim() || prev.topic, aiLanguage: prev.language }));
          setChatPrefill(data.topic.trim()
            ? (settings.language.toLowerCase().startsWith('ar') ? `حضّر درسًا كاملًا عن: ${data.topic.trim()}` : `Prepare a complete lesson on: ${data.topic.trim()}`)
            : (settings.language.toLowerCase().startsWith('ar') ? 'حضّر درسًا كاملًا' : 'Prepare a complete lesson'));
          setView('board');
        }}
      />
    );
  }

  return (
    <div className="w-screen h-screen bg-board overflow-hidden flex flex-col">
      {/* Clean Head Bar */}
      {!isRunning && (
        <TopBar
          lessonTitle={settings.topic || settings.subject || ''}
          onLessonTitleChange={(t) => setSettings(prev => ({ ...prev, topic: t }))}
          isOffline={isOffline}
          language={settings.language}
          onExportPdf={() => setIsPdfOpen(true)}
        />
      )}

      {/* Board canvas */}
      <div className="flex-1 min-h-0 relative">
        <SmartBoard
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          activeTool={activeTool}
          onAddSketch={onAddSketch}
          setNodes={setNodes}
          onPaneClick={handlePaneClick}
          penColor={penColor}
          penSize={penSize}
          onDeleteNode={handleDeleteNode}
          mode={boardMode}
          theme={boardTheme}
          activeShape={activeShape}
          smartShapes={true}
        />
      </div>


      {/* Bottom toolbar */}
      {!isRunning && (
        <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-none pb-3 px-2 flex flex-col items-center gap-2">
          <SlideRail
            mode={boardMode}
            slides={slides}
            currentIndex={currentSlideIndex}
            onSwitchMode={switchBoardMode}
            onSelect={loadSlide}
            onAdd={addSlide}
            onDelete={deleteSlide}
            language={settings.language}
          />
          <BottomToolbar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            isRunning={false}
            onToggleRun={() => setIsRunning(true)}
            onToggleChat={() => setIsChatOpen(v => !v)}
            onTogglePdf={() => setIsPdfOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onClearBoard={handleClearBoard}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={historyIndex >= 0}
            canRedo={historyIndex + 1 < history.length}
            language={settings.language}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(m => !m)}
            onAddNote={() => setActiveTool('add-note')}
            onAddText={() => setActiveTool('add-text')}
            onOpenAtlas={() => setIsAtlasOpen(true)}
            onOpenLab={() => setIsLabOpen(true)}
            onOpenWheel={() => setIsWheelOpen(true)}
            onOpenGeometry={() => setIsGeometryOpen(true)}
            onOpenCalculator={() => setIsCalcOpen(true)}
            boardTheme={boardTheme}
            onSelectTheme={(t) => {
              setBoardTheme(t);
              setPenColor(defaultInk(t));
            }}
            activeShape={activeShape}
            onSelectShape={setActiveShape}
            penColor={penColor}
          />
        </div>
      )}

      {/* Run Board overlay controls */}
      {isRunning && (
        <>
          <div className="absolute top-4 left-4 z-50">
            <div className="bg-white/90 backdrop-blur rounded-full shadow-elev-2 border border-black/5 px-4 py-2 flex items-center gap-3">
              <span className="material-symbols-rounded text-red-500 ms-fill">radio_button_checked</span>
              <span className="text-sm font-semibold text-on-surface">{settings.topic || settings.subject || 'Board'}</span>
            </div>
          </div>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
            {boardMode === 'slides' && slides.length > 1 && (
              <div className="bg-white/90 backdrop-blur rounded-full shadow-elev-2 border border-black/10 px-2 py-1.5 flex items-center gap-1">
                <button
                  onClick={() => loadSlide(Math.max(currentSlideIndex - 1, 0))}
                  disabled={currentSlideIndex <= 0}
                  className="mat-btn p-1.5 rounded-full text-on-surface/80 hover:bg-surface-variant disabled:opacity-30"
                  title={isAr ? 'الشريحة السابقة' : 'Previous slide'}
                >
                  <span className="material-symbols-rounded text-xl">{isAr ? 'chevron_right' : 'chevron_left'}</span>
                </button>
                <span className="text-xs font-semibold text-on-surface/80 tabular-nums min-w-[3rem] text-center">
                  {currentSlideIndex + 1} / {slides.length}
                </span>
                <button
                  onClick={() => loadSlide(Math.min(currentSlideIndex + 1, slides.length - 1))}
                  disabled={currentSlideIndex >= slides.length - 1}
                  className="mat-btn p-1.5 rounded-full text-on-surface/80 hover:bg-surface-variant disabled:opacity-30"
                  title={isAr ? 'الشريحة التالية' : 'Next slide'}
                >
                  <span className="material-symbols-rounded text-xl">{isAr ? 'chevron_left' : 'chevron_right'}</span>
                </button>
              </div>
            )}
            <button
              onClick={() => setIsRunning(false)}
              className="mat-btn bg-white/90 backdrop-blur border border-black/10 rounded-full px-4 py-2 flex items-center gap-2 text-sm font-medium text-on-surface shadow-elev-2 hover:bg-white"
            >
              <span className="material-symbols-rounded">fullscreen_exit</span>
              {isAr ? 'إنهاء العرض' : 'Exit run'}
            </button>
            <button
              onClick={() => setIsChatOpen(v => !v)}
              className="mat-btn bg-primary text-white rounded-full px-5 py-2 flex items-center gap-2 text-sm font-semibold shadow-elev-2"
            >
              <span className="material-symbols-rounded ms-fill">smart_toy</span>
              {isAr ? 'المعلم الذكي' : 'AI Teacher'}
            </button>
          </div>
        </>
      )}

      {/* AI Teacher bottom sheet */}
      {isChatOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/20 animate-fade-in" onClick={() => setIsChatOpen(false)}>
          <div className="w-full max-w-2xl mx-auto px-4 pb-4 animate-fade-in-down" onClick={(e) => e.stopPropagation()}>
            <AISheet
              messages={chatMessages}
              onSendMessage={submitPromptToAI}
              isLoading={isAiLoading}
              prefill={chatPrefill}
              onPrefillConsumed={() => setChatPrefill('')}
              onModeSelect={handleModeSelect}
              mode={lessonMode}
              language={settings.language}
              isMuted={isMuted}
              docs={knowledgeDocs}
              onOpenPdf={() => setIsPdfOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Pen options */}
      {!isRunning && (activeTool === 'pen' || activeTool === 'highlighter') && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-white/95 backdrop-blur shadow-elev-2 rounded-2xl px-4 py-2.5 flex items-center gap-3 border border-black/5 animate-fade-in">
            <div className="flex gap-1.5">
              {['#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7'].map(c => (
                <button
                  key={c}
                  onClick={() => setPenColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${penColor === c ? 'ring-2 ring-primary scale-110' : 'border-black/10 hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
            <div className="w-px h-6 bg-black/10" />
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-sm text-on-surface/50">line_weight</span>
              <input type="range" min="2" max="24" value={penSize} onChange={(e) => setPenSize(parseInt(e.target.value, 10))} className="w-24 accent-primary" />
              <span className="text-xs font-mono text-on-surface/50 w-5 text-right">{penSize}</span>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => setIsSettingsOpen(false)}
          onSave={(newSettings) => setSettings(newSettings)}
        />
      )}

      {isVisualizeModalOpen && (
        <VisualizeTextModal
          isOpen={isVisualizeModalOpen}
          onClose={() => setIsVisualizeModalOpen(false)}
          onVisualize={handleVisualizeText}
        />
      )}

      <PdfWorkspace
        isOpen={isPdfOpen}
        onClose={() => setIsPdfOpen(false)}
        language={settings.language}
        docs={knowledgeDocs}
        onDocAdded={handlePdfDocAdded}
        onAsk={handlePdfAsk}
        onSendPage={handlePdfSendPage}
      />

      <AtlasPanel
        open={isAtlasOpen}
        onClose={() => setIsAtlasOpen(false)}
        language={settings.language}
        onPlace={handleAtlasPlace}
      />
      <SmartLabPanel
        open={isLabOpen}
        onClose={() => setIsLabOpen(false)}
        language={settings.language}
        onPlaceElement={handlePlaceElement}
        onPlaceReaction={handlePlaceReaction}
        onPlaceText={handlePlaceLabText}
      />

      <StudentPickerModal
        isOpen={isWheelOpen}
        onClose={() => setIsWheelOpen(false)}
        language={settings.language}
      />

      <GeometryToolsOverlay
        isOpen={isGeometryOpen}
        onClose={() => setIsGeometryOpen(false)}
        language={settings.language}
      />

      <ScientificCalcModal
        isOpen={isCalcOpen}
        onClose={() => setIsCalcOpen(false)}
        language={settings.language}
      />
    </div>
  );
};

import { ErrorBoundary } from './components/ui';

const App: React.FC = () => (
  <ErrorBoundary>
    <ReactFlowProvider>
      <AppContent />
    </ReactFlowProvider>
  </ErrorBoundary>
);

export default App;
