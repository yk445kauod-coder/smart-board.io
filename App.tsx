import React, { useState, useCallback, useEffect } from 'react';
import SmartBoard from './components/Board';
import Chat from './components/Chat';
import SettingsModal from './components/SettingsModal';
import VisualizeTextModal from './components/VisualizeTextModal';
import { TeacherPersona, ToolType, ElementData, LessonDetail, ToolbarPosition, ChatMessage } from './types';
import { speakText } from './services/tts';
import { generateImageWithPollinations, sendMessageToGemini } from './services/geminiService';
import { useNodesState, useEdgesState, addEdge, useReactFlow, ReactFlowProvider } from 'reactflow';
import type { Connection, Edge, Node } from 'reactflow';

const AppContent: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition, getNodes } = useReactFlow();

  // App State
  const [activeTool, setActiveTool] = useState<ToolType>('pointer');
  const [view, setView] = useState<'home' | 'language-select' | 'board'>('home');
  const [settings, setSettings] = useState<TeacherPersona>({ name: 'Smart Tutor', language: 'Arabic', personality: 'Encouraging', voice: 'female' });
  const [isMuted, setIsMuted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVisualizeModalOpen, setIsVisualizeModalOpen] = useState(false);
  
  // AI & Chat State
  const [isAiLoading, setIsAiLoading] = useState(false);
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
      if (['add-note', 'add-text', 'add-shape'].includes(activeTool)) {
          const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          const id = `manual-${Date.now()}`;
          const typeMap: { [key: string]: 'note' | 'text' | 'shape' } = { 'add-note': 'note', 'add-text': 'text', 'add-shape': 'shape' };
          const dataMap: any = {
            'add-note': { content: 'New Note', color: '#fff740' },
            'add-text': { text: 'Type something...', color: '#333' },
            'add-shape': { shapeType: 'rectangle', color: '#a8e6cf' },
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

  const submitPromptToAI = useCallback(async (prompt: string) => {
      const userMsg: ChatMessage = { role: 'user', text: prompt, timestamp: Date.now() };
      setChatMessages(prev => [...prev, userMsg]);
      setIsAiLoading(true);

      try {
        const responseText = await sendMessageToGemini(prompt, settings.language, lessonDetail, handleToolCall);
        if(responseText){
          const aiMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
          setChatMessages(prev => [...prev, aiMsg]);
        }
      } catch (err: any) {
        const errorMsg: ChatMessage = { role: 'model', text: `An error occurred: ${err.message || 'Please try again.'}`, timestamp: Date.now() };
        setChatMessages(prev => [...prev, errorMsg]);
      } finally {
        setIsAiLoading(false);
      }
  }, [settings.language, lessonDetail, handleToolCall]);

  const handleVisualizeText = useCallback((textToVisualize: string) => {
    setIsVisualizeModalOpen(false);
    const prompt = `Please summarize and create a rich visual representation of the following text on the board. Use a combination of mind maps, notes, lists, and diagrams to explain the key concepts clearly. Here is the text: "${textToVisualize}"`;
    submitPromptToAI(prompt);
  }, [submitPromptToAI]);

  // --- RENDER LOGIC ---
  if (view === 'home') {
    return (
        <div className="w-full h-screen bg-[#fdfbf7] flex flex-col items-center justify-center text-center p-4 relative">
            <h1 className="text-6xl font-bold mb-4 text-gray-800">SmartBoard AI</h1>
            <p className="text-xl mb-8 text-gray-600">The Intelligent Infinite Canvas for Teaching</p>
            <button onClick={() => setView('language-select')} className="px-8 py-3 bg-indigo-600 text-white rounded-full text-xl shadow-lg hover:bg-indigo-700 transition">
                {settings.language.startsWith('ar') ? 'ابدأ' : 'Get Started'}
            </button>
            <footer className="absolute bottom-4 text-gray-500 text-sm">
                Developed by Yousef Khamis
            </footer>
        </div>
    );
  }

  if (view === 'language-select') {
    const languages = ['Arabic', 'English', 'French', 'Italian'];
    return (
        <div className="w-full h-screen bg-[#fdfbf7] flex flex-col items-center justify-center text-center p-4 animate-fade-in">
            <button onClick={() => setView('home')} className="absolute top-6 left-6 text-gray-500 hover:text-indigo-600">
                <i className="fa-solid fa-arrow-left mr-2"></i> Back
            </button>
            <h2 className="text-4xl font-bold mb-2 text-gray-800">Choose a Language</h2>
            <p className="text-lg mb-8 text-gray-600">Select the language for the AI to teach in.</p>
            <div className="grid grid-cols-2 gap-4 mb-8">
                {languages.map(lang => (
                    <button 
                        key={lang}
                        onClick={() => setSettings(s => ({...s, language: lang}))}
                        className={`px-8 py-4 rounded-xl border-2 text-xl font-medium transition-all ${settings.language === lang ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-500'}`}
                    >
                        {lang}
                    </button>
                ))}
            </div>
            <button onClick={() => setView('board')} className="px-12 py-3 bg-green-600 text-white rounded-full text-xl shadow-lg hover:bg-green-700 transition">
                Start Lesson <i className="fa-solid fa-arrow-right ml-2"></i>
            </button>
        </div>
    );
  }

  const Toolbar = () => {
    const isTop = toolbarPosition === 'top';
    const baseClasses = "bg-white/90 backdrop-blur shadow-xl rounded-2xl border border-gray-200 transition-all duration-300";
    const layoutClasses = isTop ? "flex flex-wrap items-center gap-1 p-2" : "flex flex-col items-center gap-2 p-3";
    const transformClass = isToolbarHidden ? (isTop ? "-translate-y-24 opacity-0" : "-translate-x-24 opacity-0") : (isTop ? "translate-y-0 opacity-100" : "translate-x-0 opacity-100");
    const colors = ['#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7'];

    const ToolBtn = ({ id, icon, label, onClick }: any) => (
        <button onClick={onClick || (() => setActiveTool(id))} className={`p-3 rounded-xl ${activeTool === id ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`} title={label}>
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
                <div className={isTop ? "w-px h-6 bg-gray-300 mx-2" : "h-px w-8 bg-gray-300 my-2"}></div>
                <ToolBtn id="visualize-data" icon="fa-file-import" label="Visualize Data" onClick={() => setIsVisualizeModalOpen(true)} />
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
    </div>
  );
};

const App: React.FC = () => (
  <ReactFlowProvider>
    <AppContent />
  </ReactFlowProvider>
);

export default App;
