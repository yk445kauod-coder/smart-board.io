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
import { TeacherPersona, ToolType, ElementData, LessonDetail, ToolbarPosition, ChatMessage, KnowledgeDoc, LessonMode, TeachingMode } from './types';
import { speakText, cancelSpeech } from './services/tts';
import { generateImageWithPollinations } from './services/geminiService';
import { generateLesson } from './services/ai/assistant';
import { useNodesState, useEdgesState, addEdge, useReactFlow, ReactFlowProvider } from 'reactflow';
import type { Connection, Edge, Node } from 'reactflow';

const AppContent: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition, getNodes } = useReactFlow();

  // App State
  const [activeTool, setActiveTool] = useState<ToolType>('pointer');
  const [view, setView] = useState<'home' | 'language-select' | 'board'>('home');
  const [settings, setSettings] = useState<TeacherPersona>({ name: 'Smart Tutor', language: 'Arabic', subject: 'General Knowledge', personality: 'Encouraging', voice: 'female' });
  const [isMuted, setIsMuted] = useState(false);
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
  const [chatPrefill, setChatPrefill] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'أهلاً بك! أنا مساعدك البصري. عن ماذا تريد أن نتعلم اليوم؟', timestamp: Date.now() }
  ]);

  // New Features State
  const [lessonDetail, setLessonDetail] = useState<LessonDetail>('brief');
  const [toolbarPosition, setToolbarPosition] = useState<ToolbarPosition>('top');
  const [isToolbarHidden, setIsToolbarHidden] = useState(false);
  
  // Pen Options
  const [penColor, setPenColor] = useState('#000000');
  const [penSize, setPenSize] = useState(6);

  // Undo/Redo stacks
  const [history, setHistory] = useState<Array<{ nodes: Node<ElementData>[]; edges: Edge[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyLock = useRef(false);
  const lastNodes = useRef<Node<ElementData>[]>([]);
  const lastEdges = useRef<Edge[]>([]);

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
          const dataMap: any = {
            'add-note': { content: 'New Note', color: '#fff740' },
            'add-text': { text: 'Type something...', color: '#333' },
            'add-shape': { shapeType: 'rectangle', color: '#a8e6cf' },
            'add-ruler': { width: 400, height: 50, rotation: 0 },
          };
          const newNode: Node = { id, type: typeMap[activeTool], position, data: { id, type: typeMap[activeTool], ...dataMap[activeTool] }};
          setNodes((nds) => [...nds, newNode]);
      }
  }, [activeTool, screenToFlowPosition, setNodes]);
  
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
          const rootId = id; // Use passed-in ID for the root

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
             };
             const nodeType = typeMap[name];
             if(nodeType) {
                const data: Record<string, unknown> = { ...args, type: nodeType };
                // Normalize graph-based nodes into the data shape the renderers expect.
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
        speakText(textToSpeak, settings.language, isMuted);
      }
  }, [setNodes, setEdges, getNodes, settings, isMuted]);

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
      data: { id, type: 'image', imageUrl: url, title, width: 540, height: 380 },
    }]);
    setIsPdfOpen(false);
  }, [setNodes]);

const submitPromptToAI = useCallback(async (prompt: string, mode?: LessonMode) => {
    const nextMode = mode || lessonMode;
    cancelSpeech(); // Stop any previous speech
    const userMsg: ChatMessage = { role: 'user', text: prompt, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    setIsAiLoading(true);

    try {
      // Gather context from the current board
      const selected = nodes.filter((n: Node) => (n as any).selected).map((n: Node) => ({
        id: n.id,
        type: String((n.data as any)?.type || 'note'),
        text: (n.data as any)?.text as string | undefined,
        title: (n.data as any)?.title as string | undefined,
        items: (n.data as any)?.items as string[] | undefined,
        content: (n.data as any)?.content as string | undefined,
      }));

      const allNodes = nodes.map((n: Node) => (n.data as any)?.text || (n.data as any)?.title || (n.data as any)?.content || '' ).filter(Boolean);
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
      }, handleToolCall, (speech: string) => speakText(speech, settings.language, isMuted));

      if (responseText) {
        const aiMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
        setChatMessages(prev => [...prev, aiMsg]);
      } else {
        const aiMsg: ChatMessage = { role: 'model', text: settings.language.toLowerCase().startsWith('ar') ? 'تم.' : 'Done.', timestamp: Date.now() };
        setChatMessages(prev => [...prev, aiMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = { role: 'model', text: `An error occurred: ${err.message || 'Please try again.'}`, timestamp: Date.now() };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsAiLoading(false);
    }
  }, [lessonMode, settings, lessonDetail, knowledgeDocs, nodes, handleToolCall]);

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

  // Clean up when leaving board
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
        onLanguageChange={(lang) => setSettings(prev => ({ ...prev, language: lang }))}
        onNewSubjectInput={setNewSubjectInput}
        onAddSubject={handleAddSubject}
        onStart={(data) => {
          if (data.file) handlePdfDocAdded(data.file);
          setSettings(prev => ({ ...prev, name: data.name.trim() || prev.name, mode: data.mode, topic: data.topic.trim() || prev.topic }));
          setChatPrefill(data.topic.trim()
            ? (settings.language.toLowerCase().startsWith('ar') ? `حضّر درسًا كاملًا عن: ${data.topic.trim()}` : `Prepare a complete lesson on: ${data.topic.trim()}`)
            : (settings.language.toLowerCase().startsWith('ar') ? 'حضّر درسًا كاملًا' : 'Prepare a complete lesson'));
          setView('board');
        }}
      />
    );
  }

  const isAr = settings.language.toLowerCase().startsWith('ar');

  return (
    <div className="w-screen h-screen bg-board overflow-hidden flex flex-col">
      {/* Board canvas — always fills the screen */}
      <div className={`flex-1 min-h-0 relative ${isRunning ? '' : 'p-2'} ${isRunning ? '' : 'pt-3'}`}>
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
        />
      </div>

      {/* Top status chip (compact, Material) */}
      {!isRunning && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="bg-white/80 backdrop-blur rounded-full shadow-elev-1 border border-black/5 px-4 py-1.5 flex items-center gap-2 text-xs text-on-surface/70">
            <span className="material-symbols-rounded text-sm text-primary ms-fill">cast_for_education</span>
            <span className="font-medium">{settings.subject || 'General'}</span>
            {settings.topic && <span className="hidden sm:inline text-on-surface/40">·</span>}
            {settings.topic && <span className="hidden sm:inline max-w-[16rem] truncate">{settings.topic}</span>}
          </div>
        </div>
      )}

      {/* Bottom toolbar — main control center */}
      {!isRunning && (
        <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-none pb-3 px-2 flex justify-center">
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

      {/* AI Teacher bottom sheet (temporary overlay, not permanent) */}
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

      {/* Pen options (color + size) — compact Material popover above toolbar */}
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
    </div>
  );
};

const App: React.FC = () => (
  <ReactFlowProvider>
    <AppContent />
  </ReactFlowProvider>
);

export default App;
