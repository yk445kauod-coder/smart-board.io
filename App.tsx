import React, { useState, useCallback, useEffect } from 'react';
import SmartBoard from './components/Board';
import Chat from './components/Chat';
import SettingsModal from './components/SettingsModal';
import VisualizeTextModal from './components/VisualizeTextModal';
import PdfWorkspace from './components/PdfWorkspace';
import Onboarding from './components/Onboarding';
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
             };
             const nodeType = typeMap[name];
             if(nodeType) {
                setNodes(nds => [...nds, { id, type: nodeType, position: { x: args.x || defaultPos.x, y: args.y || defaultPos.y }, data: { ...args, type: nodeType } }]);
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
  if (view === 'home') {
    return (
        <div className="w-full h-screen relative overflow-hidden bg-gray-50 flex items-center justify-center">
            {/* Animated Background Blobs */}
            <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
            <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
            
            {/* Floating Educational Icons */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <i className="fa-solid fa-calculator text-4xl text-blue-400 absolute top-[15%] left-[10%] animate-float opacity-40"></i>
                <i className="fa-solid fa-flask text-4xl text-green-400 absolute top-[25%] right-[15%] animate-float-delayed opacity-40"></i>
                <i className="fa-solid fa-palette text-5xl text-purple-400 absolute bottom-[20%] left-[20%] animate-float opacity-40"></i>
                <i className="fa-solid fa-atom text-5xl text-indigo-400 absolute bottom-[15%] right-[10%] animate-float-fast opacity-40"></i>
                <i className="fa-solid fa-shapes text-3xl text-orange-400 absolute top-[40%] left-[5%] animate-float opacity-30"></i>
                <i className="fa-solid fa-globe text-6xl text-teal-400 absolute top-[10%] left-[45%] animate-float-delayed opacity-20"></i>
                <i className="fa-solid fa-dna text-3xl text-red-400 absolute bottom-[40%] right-[5%] animate-float opacity-30"></i>
            </div>

            {/* Glassmorphic Central Content */}
            <div className="relative z-10 p-12 bg-white/30 backdrop-blur-lg rounded-3xl border border-white/50 shadow-2xl flex flex-col items-center text-center max-w-2xl mx-4">
                <div className="mb-6 bg-white/80 p-6 rounded-full shadow-lg animate-float-fast">
                     <i className="fa-solid fa-wand-magic-sparkles text-6xl text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600"></i>
                </div>
                
                <h1 className="text-6xl md:text-7xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 drop-shadow-sm">
                    SmartBoard AI
                </h1>
                
                <p className="text-xl md:text-2xl text-gray-700 mb-10 font-light max-w-lg leading-relaxed">
                    Transforming ideas into <span className="font-semibold text-indigo-600">Visual Knowledge</span>. 
                    <br/>The intelligent canvas for modern education.
                </p>
                
                <button 
                    onClick={() => setView('language-select')} 
                    className="group relative px-10 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full text-2xl font-bold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                >
                    <span className="relative z-10 flex items-center gap-3">
                         {settings.language.startsWith('ar') ? 'ابدأ الرحلة' : 'Enter Workspace'} 
                         <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                    </span>
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                </button>
                
                <footer className="mt-8 text-gray-500 text-sm font-medium opacity-80">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                    AI Systems Operational
                </footer>
            </div>
            
            {/* Creator Tag */}
            <div className="absolute bottom-6 font-mono text-gray-400 text-xs">
                 Crafted by Yousef Khamis
            </div>
        </div>
    );
  }

if (view === 'language-select') {
    return (
        <Onboarding
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
                    ? (settings.language.startsWith('ar') ? `حضّر درسًا كاملًا عن: ${data.topic.trim()}` : `Prepare a complete lesson on: ${data.topic.trim()}`)
                    : (settings.language.startsWith('ar') ? 'حضّر درسًا كاملًا' : 'Prepare a complete lesson'));
                setView('board');
            }}
        />
    );
  }
  const Toolbar = () => {
    const isTop = toolbarPosition === 'top';
    const baseClasses = "bg-white/90 backdrop-blur shadow-xl rounded-2xl border border-gray-200 transition-all duration-300";
    const layoutClasses = isTop ? "flex flex-wrap items-center gap-1 p-2" : "flex flex-col items-center gap-2 p-3";
    const transformClass = isToolbarHidden ? (isTop ? "-translate-y-24 opacity-0" : "-translate-x-24 opacity-0") : (isTop ? "translate-y-0 opacity-100" : "translate-x-0 opacity-100");
    const colors = ['#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7'];

    const ToolBtn = ({ id, icon, label, onClick }: any) => (
        <button aria-label={label} onClick={onClick || (() => setActiveTool(id))} className={`p-3 rounded-xl ${activeTool === id ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`} title={label}>
            <i className={`fa-solid ${icon} text-lg`}></i>
        </button>
    );

    return (
        <div className="flex flex-col items-center gap-2">
            <div className={`${baseClasses} ${layoutClasses} ${transformClass}`}>
                <ToolBtn id="pointer" icon="fa-arrow-pointer" label="Select" />
                <ToolBtn id="pan" icon="fa-hand" label="Pan" />
                <div className={isTop ? "w-px h-6 bg-gray-300 mx-2" : "h-px w-8 bg-gray-300 my-2"}></div>
                <ToolBtn id="pen" icon="fa-pen" label="Pen" />
                <ToolBtn id="eraser" icon="fa-eraser" label="Eraser" />
                <div className={isTop ? "w-px h-6 bg-gray-300 mx-2" : "h-px w-8 bg-gray-300 my-2"}></div>
                <ToolBtn id="add-note" icon="fa-note-sticky" label="Note" />
                <ToolBtn id="add-text" icon="fa-font" label="Text" />
                <ToolBtn id="add-shape" icon="fa-shapes" label="Shape" />
                <ToolBtn id="add-ruler" icon="fa-ruler-horizontal" label="Ruler" />
                <div className={isTop ? "w-px h-6 bg-gray-300 mx-2" : "h-px w-8 bg-gray-300 my-2"}></div>
                <ToolBtn id="visualize-data" icon="fa-file-import" label="Visualize Data" onClick={() => setIsVisualizeModalOpen(true)} />
                <ToolBtn id="pdf" icon="fa-file-pdf" label="PDF Workspace" onClick={() => setIsPdfOpen(true)} />
                <ToolBtn id="clear-board" icon="fa-trash-can" label="Clear Board" onClick={handleClearBoard} />
                <div className={isTop ? "w-px h-6 bg-gray-300 mx-2" : "h-px w-8 bg-gray-300 my-2"}></div>
                <button onClick={() => setLessonDetail(d => d === 'brief' ? 'detailed' : 'brief')} className={`p-3 rounded-xl ${lessonDetail === 'detailed' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500'}`} title={lessonDetail === 'brief' ? 'Switch to Detailed' : 'Switch to Brief'}>
                    <i className={`fa-solid ${lessonDetail === 'brief' ? 'fa-align-left' : 'fa-align-justify'}`}></i>
                </button>
                <button onClick={() => setToolbarPosition(p => p === 'top' ? 'left' : 'top')} className="p-3 text-gray-500 rounded-xl" title="Move Toolbar"><i className={`fa-solid ${toolbarPosition === 'top' ? 'fa-arrow-down-to-line' : 'fa-arrow-right-to-line'}`}></i></button>
                <button onClick={() => setIsToolbarHidden(true)} className="p-3 text-gray-500 rounded-xl" title="Hide Toolbar"><i className="fa-solid fa-eye-slash"></i></button>
                <button onClick={() => setIsSettingsOpen(true)} className="p-3 text-gray-500 rounded-xl hover:bg-gray-100" title="Settings"><i className="fa-solid fa-gear"></i></button>
            </div>
            {(activeTool === 'pen' || activeTool === 'highlighter') && !isToolbarHidden && (
                 <div className="bg-white/95 backdrop-blur shadow-lg rounded-xl p-2 flex items-center gap-3 border border-gray-200 animate-fade-in-down">
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                        {colors.map(c => <button key={c} onClick={() => setPenColor(c)} className={`w-6 h-6 rounded-md border-2 ${penColor === c ? 'ring-2 ring-indigo-500' : 'border-gray-200'}`} style={{ backgroundColor: c }} />)}
                    </div>
                    <input type="range" min="2" max="24" value={penSize} onChange={(e) => setPenSize(parseInt(e.target.value, 10))} className="w-24" />
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="w-screen h-screen bg-board overflow-hidden flex flex-col">
      <div className={`absolute z-50 transition-all duration-300 ${toolbarPosition === 'top' ? 'top-4 left-1/2 -translate-x-1/2' : 'left-4 top-1/2 -translate-y-1/2'}`}>
          <Toolbar />
      </div>

      {isToolbarHidden && (
          <button onClick={() => setIsToolbarHidden(false)} className="absolute top-4 left-4 z-50 bg-white/80 p-3 rounded-xl shadow-lg" title="Show Toolbar">
              <i className="fa-solid fa-eye"></i>
          </button>
      )}

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
      
      <Chat
        messages={chatMessages}
        onSendMessage={submitPromptToAI}
        isLoading={isAiLoading}
        prefill={chatPrefill}
        onPrefillConsumed={() => setChatPrefill('')}
        onModeSelect={handleModeSelect}
        mode={lessonMode}
        language={settings.language}
        isMuted={isMuted}
      />
      
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