import React, { useState, useCallback, useEffect } from 'react';
import SmartBoard from './components/Board';
import Chat from './components/Chat';
import SettingsModal from './components/SettingsModal';
import EditNodeModal from './components/EditNodeModal';
import { TeacherPersona, ToolType, ElementData, LessonDetail, ToolbarPosition } from './types';
import { speakText } from './services/tts';
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
  const [editingNode, setEditingNode] = useState<Node<ElementData> | null>(null);

  // New Features State
  const [lessonDetail, setLessonDetail] = useState<LessonDetail>('brief');
  const [toolbarPosition, setToolbarPosition] = useState<ToolbarPosition>('top');
  const [isToolbarHidden, setIsToolbarHidden] = useState(false);
  
  // Pen Options
  const [penColor, setPenColor] = useState('#000000');
  const [penSize, setPenSize] = useState(6);

  // --- Core Handlers ---
  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);
  const handleDeleteNode = useCallback((id: string) => { setNodes((nds) => nds.filter((n) => n.id !== id)); setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id)); }, [setNodes, setEdges]);
  const handleEditNode = useCallback((id: string, newData: Partial<ElementData>) => setNodes((nds) => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...newData } } : n)), [setNodes]);
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => setEditingNode(node), []);
  const onAddSketch = useCallback((sketchNode: Node) => setNodes((nds) => [...nds, sketchNode]), [setNodes]);

  useEffect(() => { (window as any).deleteNode = handleDeleteNode; }, [handleDeleteNode]);
  
  // --- UI Handlers ---
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
      if (['add-note', 'add-text', 'add-shape'].includes(activeTool)) {
          const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          const id = `manual-${Date.now()}`;
          const typeMap: { [key: string]: 'note' | 'wordArt' | 'shape' } = { 'add-note': 'note', 'add-text': 'wordArt', 'add-shape': 'shape' };
          const dataMap: any = {
            'add-note': { content: 'New Note', color: '#fff740' },
            'add-text': { text: 'Type Here', color: '#000' },
            'add-shape': { shapeType: 'rectangle', color: '#a8e6cf' },
          };
          const newNode: Node = { id, type: typeMap[activeTool], position, data: { id, type: typeMap[activeTool], ...dataMap[activeTool] }};
          setNodes((nds) => [...nds, newNode]);
      }
  }, [activeTool, screenToFlowPosition, setNodes]);
  
  const handleToolCall = useCallback(async (name: string, args: any) => {
      const id = `ai-${Date.now()}`;
      const defaultPos = { x: 800 + Math.random() * 200 - 100, y: 450 + Math.random() * 100 - 50};
      let textToSpeak = "";

      switch (name) {
        case 'addNote':
            textToSpeak = args.content;
            setNodes(nds => [...nds, { id, type: 'note', position: { x: args.x || defaultPos.x, y: args.y || defaultPos.y }, data: { id, type: 'note', ...args } }]);
            break;
        case 'addImage':
            const encodedDesc = encodeURIComponent(args.description);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedDesc}?width=512&height=512&nologo=true&seed=${Math.random()}`;
            setNodes(nds => [...nds, { id, type: 'image', position: { x: args.x || defaultPos.x, y: args.y || defaultPos.y }, data: { id, type: 'image', url: imageUrl, ...args } }]);
            break;
        default:
             setNodes(nds => [...nds, { id, type: name as any, position: { x: args.x || defaultPos.x, y: args.y || defaultPos.y }, data: { id, type: name, ...args } }]);
             if (args.content) textToSpeak = args.content;
             if (args.text) textToSpeak = args.text;
      }

      if (textToSpeak) {
        speakText(textToSpeak, settings.language, isMuted);
      }
  }, [setNodes, getNodes, settings, isMuted]);

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


  // Toolbar Component
  const Toolbar = () => {
    const isTop = toolbarPosition === 'top';
    const baseClasses = "bg-white/90 backdrop-blur shadow-xl rounded-2xl border border-gray-200 transition-all duration-300";
    const layoutClasses = isTop ? "flex items-center gap-1 p-2" : "flex flex-col items-center gap-2 p-3";
    const transformClass = isToolbarHidden ? (isTop ? "-translate-y-20 opacity-0" : "-translate-x-20 opacity-0") : (isTop ? "translate-y-0 opacity-100" : "translate-x-0 opacity-100");
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
                <button onClick={() => setLessonDetail(d => d === 'brief' ? 'detailed' : 'brief')} className={`p-3 rounded-xl ${lessonDetail === 'detailed' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500'}`} title={lessonDetail === 'brief' ? 'Switch to Detailed' : 'Switch to Brief'}>
                    <i className={`fa-solid ${lessonDetail === 'brief' ? 'fa-align-left' : 'fa-align-justify'}`}></i>
                </button>
                <button onClick={() => setToolbarPosition(p => p === 'top' ? 'left' : 'top')} className="p-3 text-gray-500 rounded-xl" title="Move Toolbar"><i className={`fa-solid ${toolbarPosition === 'top' ? 'fa-arrow-down-to-line' : 'fa-arrow-right-to-line'}`}></i></button>
                <button onClick={() => setIsToolbarHidden(true)} className="p-3 text-gray-500 rounded-xl" title="Hide Toolbar"><i className="fa-solid fa-eye-slash"></i></button>
            </div>
            {(activeTool === 'pen' || activeTool === 'highlighter') && !isToolbarHidden && (
                 <div className="bg-white/95 backdrop-blur shadow-lg rounded-xl p-2 flex items-center gap-3 border border-gray-200 animate-fade-in-down">
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                        {colors.map(c => <button key={c} onClick={() => setPenColor(c)} className={`w-6 h-6 rounded-md border-2 ${penColor === c ? 'ring-2 ring-indigo-500' : 'border-gray-200'}`} style={{ backgroundColor: c }}/>)}
                    </div>
                    <div className="w-px h-4 bg-gray-300"></div>
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-circle text-[8px] text-gray-400"></i>
                        <input type="range" min="2" max="30" value={penSize} onChange={(e) => setPenSize(parseInt(e.target.value))} className="w-24"/>
                        <i className="fa-solid fa-circle text-lg text-gray-400"></i>
                    </div>
                 </div>
            )}
        </div>
    );
  };

  return (
    <div className="w-full h-screen relative bg-gray-100 overflow-hidden">
        {isToolbarHidden && (
            <button onClick={() => setIsToolbarHidden(false)} className="absolute top-4 left-4 z-[100] p-3 bg-white rounded-full shadow-lg" title="Show Toolbar"><i className="fa-solid fa-eye"></i></button>
        )}
        
        <div className={`absolute z-[100] transition-all duration-300 ${toolbarPosition === 'top' ? 'top-4 left-1/2 -translate-x-1/2' : 'left-4 top-1/2 -translate-y-1/2'}`}>
            <Toolbar />
        </div>

        <SmartBoard nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} activeTool={activeTool} onAddSketch={onAddSketch} setNodes={setNodes} onPaneClick={handlePaneClick} penColor={penColor} penSize={penSize} onDeleteNode={handleDeleteNode} onNodeContextMenu={handleNodeContextMenu} />
        <Chat onToolCall={handleToolCall} language={settings.language} projectorMode={false} lessonDetail={lessonDetail} />
        {editingNode && <EditNodeModal node={editingNode} onSave={handleEditNode} onClose={() => setEditingNode(null)} />}
    </div>
  );
};

const App = () => (<ReactFlowProvider><AppContent /></ReactFlowProvider>);
export default App;