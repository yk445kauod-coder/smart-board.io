import React, { useState, useCallback, useEffect, useRef } from 'react';
import SmartBoard from './components/Board';
import Chat from './components/Chat';
import SettingsModal from './components/SettingsModal';
import EditNodeModal from './components/EditNodeModal';
import { 
    TeacherPersona, 
    ToolType, 
    Language,
    ElementData
} from './types';
import { speakText } from './services/tts';
import { 
    useNodesState, 
    useEdgesState, 
    addEdge, 
    useReactFlow,
    ReactFlowProvider
} from 'reactflow';
import type { Connection, Edge, Node } from 'reactflow';

const AppContent: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition, getNodes } = useReactFlow();

  const [activeTool, setActiveTool] = useState<ToolType>('pointer');
  const [view, setView] = useState<'home' | 'board'>('home');
  const [settings, setSettings] = useState<TeacherPersona>({
    name: 'Smart Tutor',
    language: 'ar',
    personality: 'Encouraging',
    voice: 'female'
  });
  const [showSettings, setShowSettings] = useState(false);
  const [projectorMode, setProjectorMode] = useState(false);
  
  // Drawing Options
  const [penColor, setPenColor] = useState('#000000');
  const [penSize, setPenSize] = useState(6);
  
  // Node Editing
  const [editingNode, setEditingNode] = useState<Node<ElementData> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // robust delete function
  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [setNodes, setEdges]);
  
  // Handle Edit Node Save
  const handleEditNode = useCallback((id: string, newData: Partial<ElementData>) => {
      setNodes((nds) => nds.map(n => {
          if (n.id === id) {
              return { ...n, data: { ...n.data, ...newData } };
          }
          return n;
      }));
  }, [setNodes]);

  // Handle Right Click on Node
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
      setEditingNode(node);
  }, []);

  useEffect(() => {
      (window as any).deleteNode = handleDeleteNode;
  }, [handleDeleteNode]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  // Handle Board Click for Manual Tools
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    const manualTools = ['add-note', 'add-text', 'add-shape'];
    if (!manualTools.includes(activeTool)) return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const id = `manual-${Date.now()}`;
    let newNode: Node | null = null;

    switch (activeTool) {
        case 'add-note':
            newNode = {
                id, type: 'note', position,
                data: { id, type: 'note', content: 'New Note', style: 'normal', color: '#fff740' }
            };
            break;
        case 'add-text':
            newNode = {
                id, type: 'wordArt', position,
                data: { id, type: 'wordArt', text: 'Type Here', color: '#000' }
            };
            break;
        case 'add-shape':
            newNode = {
                id, type: 'shape', position,
                data: { id, type: 'shape', shapeType: 'rectangle', color: '#a8e6cf' }
            };
            break;
    }

    if (newNode) {
        setNodes((nds) => [...nds, newNode!]);
    }

  }, [activeTool, screenToFlowPosition, setNodes]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
              const url = e.target?.result as string;
              const id = `img-${Date.now()}`;
              const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
              
              const newNode: Node = {
                  id, type: 'image', position,
                  data: { id, type: 'image', description: 'User Upload', url }
              };
              setNodes((nds) => [...nds, newNode]);
          };
          reader.readAsDataURL(file);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      setActiveTool('pointer');
  };

  const triggerImageUpload = () => {
      setActiveTool('add-image');
      fileInputRef.current?.click();
  };

  const handleToolCall = useCallback(async (name: string, args: any) => {
    const id = Math.random().toString(36).substr(2, 9);
    const count = getNodes().length;
    const angle = count * 0.5;
    const radius = 100 + (count * 20);
    const defaultX = args.x ?? (Math.cos(angle) * radius + 400); 
    const defaultY = args.y ?? (Math.sin(angle) * radius + 300);

    let newNode: Node | null = null;
    let textToSpeak = "";

    switch (name) {
      case 'addNote':
        newNode = {
            id, type: 'note', position: { x: defaultX, y: defaultY },
            data: { id, type: 'note', content: args.content, style: args.style, color: args.color }
        };
        textToSpeak = args.content;
        break;
      case 'addList':
        newNode = {
            id, type: 'list', position: { x: defaultX, y: defaultY },
            data: { id, type: 'list', items: args.items, title: args.title, color: args.color }
        };
        textToSpeak = args.title || "Here is a list.";
        break;
      case 'addImage':
        const encodedDesc = encodeURIComponent(args.description);
        const seed = Math.floor(Math.random() * 100000);
        
        // Improve Pollinations with randomized style models for variety
        const styles = ['flux', 'flux-realism', 'flux-anime', 'flux-3d', 'any-dark'];
        const randomStyle = styles[Math.floor(Math.random() * styles.length)];
        
        newNode = {
            id, type: 'image', position: { x: defaultX, y: defaultY },
            data: { 
                id, type: 'image', description: args.description, 
                url: `https://image.pollinations.ai/prompt/${encodedDesc}?width=512&height=512&nologo=true&seed=${seed}&model=${randomStyle}`
            }
        };
        // DISABLE TTS for image descriptions as requested
        textToSpeak = ""; 
        break;
      case 'addShape':
        newNode = {
            id, type: 'shape', position: { x: defaultX, y: defaultY },
            data: { id, type: 'shape', shapeType: args.shapeType, color: args.color }
        };
        break;
      case 'addWordArt':
        newNode = {
            id, type: 'wordArt', position: { x: defaultX, y: defaultY },
            data: { id, type: 'wordArt', text: args.text, color: args.color }
        };
        textToSpeak = args.text;
        break;
      case 'addCode':
        newNode = {
            id, type: 'code', position: { x: defaultX, y: defaultY },
            data: { id, type: 'code', code: args.code, language: args.language }
        };
        break;
      case 'connectElements':
        if (args.fromId && args.toId) {
            setEdges((eds) => addEdge({ 
                id, source: args.fromId, target: args.toId, animated: true 
            }, eds));
        }
        return "Connected";
    }

    if (newNode) {
        setNodes((nds) => [...nds, newNode!]);
        if (textToSpeak && settings.voice) {
            speakText(textToSpeak, settings.language);
        }
        return "Added element";
    }
    return "Done";
  }, [setNodes, setEdges, getNodes, settings]);

  const onAddSketch = useCallback((sketchNode: Node) => {
      setNodes((nds) => [...nds, sketchNode]);
  }, [setNodes]);

  if (view === 'home') {
      return (
          <div className="w-full h-screen bg-[#fdfbf7] flex flex-col items-center justify-center font-sans relative overflow-hidden text-center p-4">
              <h1 className="text-6xl font-bold mb-4 text-gray-800">SmartBoard AI</h1>
              <p className="text-xl mb-8 text-gray-600">The Intelligent Infinite Canvas for Teaching</p>
              <button 
                  onClick={() => setView('board')}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-full text-xl shadow-lg hover:bg-indigo-700 transition"
              >
                  {settings.language === 'ar' ? 'ابدأ الدرس' : 'Start Lesson'}
              </button>
              
              <div className="mt-8 flex gap-4">
                  <button onClick={() => setSettings(s => ({...s, language: s.language === 'ar' ? 'en' : 'ar'}))} className="underline text-gray-500">
                      {settings.language === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
                  </button>
              </div>
          </div>
      );
  }

  const ToolBtn = ({ id, icon, label, onClick }: { id: string, icon: string, label?: string, onClick?: () => void }) => (
      <button
          onClick={onClick || (() => setActiveTool(id as ToolType))}
          className={`p-3 rounded-xl transition-all flex items-center justify-center relative group
            ${activeTool === id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
          title={label}
      >
          <i className={`fa-solid ${icon} text-lg`}></i>
          {label && (
              <span className="absolute -bottom-8 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50">
                  {label}
              </span>
          )}
      </button>
  );

  const colors = ['#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7'];

  return (
    <div className="w-full h-screen relative bg-gray-100 overflow-hidden">
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleImageUpload} 
        />

        {/* Floating Toolbar */}
        <div className="flex flex-col items-center absolute top-4 left-1/2 -translate-x-1/2 z-[100]">
            <div 
                className={`bg-white/90 backdrop-blur shadow-xl rounded-2xl flex items-center gap-1 border border-gray-200 transition-all duration-300
                ${projectorMode ? 'scale-125 p-3' : 'scale-100 p-2'}`}
            >
                <button onClick={() => setView('home')} className="p-3 hover:bg-gray-100 rounded-xl text-gray-500" title="Home"><i className="fa-solid fa-house"></i></button>
                <div className="w-px h-6 bg-gray-300 mx-2"></div>
                
                <ToolBtn id="pointer" icon="fa-arrow-pointer" label="Select" />
                <ToolBtn id="pan" icon="fa-hand" label="Pan" />
                
                <div className="w-px h-6 bg-gray-300 mx-2"></div>
                
                <ToolBtn id="pen" icon="fa-pen" label="Pen" />
                <ToolBtn id="highlighter" icon="fa-highlighter" label="Highlight" />
                <ToolBtn id="eraser" icon="fa-eraser" label="Eraser" />
                
                <div className="w-px h-6 bg-gray-300 mx-2"></div>

                <ToolBtn id="add-note" icon="fa-note-sticky" label="Sticky Note" />
                <ToolBtn id="add-text" icon="fa-font" label="Text" />
                <ToolBtn id="add-image" icon="fa-image" label="Upload Image" onClick={triggerImageUpload} />
                <ToolBtn id="add-shape" icon="fa-shapes" label="Shape" />
                
                <div className="w-px h-6 bg-gray-300 mx-2"></div>
                
                <button 
                    onClick={() => setNodes([])} 
                    className="p-3 hover:bg-red-50 text-red-500 rounded-xl"
                    title="Clear Board"
                >
                    <i className="fa-solid fa-trash-can"></i>
                </button>
                <button onClick={() => setShowSettings(true)} className="p-3 hover:bg-gray-100 rounded-xl text-gray-500" title="Settings"><i className="fa-solid fa-gear"></i></button>
                
                <div className="w-px h-6 bg-gray-300 mx-2"></div>
                <button 
                    onClick={() => setProjectorMode(!projectorMode)} 
                    className={`p-3 rounded-xl transition-all ${projectorMode ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                    title="Projector Mode"
                >
                    <i className={`fa-solid ${projectorMode ? 'fa-compress' : 'fa-expand'}`}></i>
                </button>
            </div>

            {/* Sub-Toolbar for Drawing Options */}
            {(activeTool === 'pen' || activeTool === 'highlighter') && (
                 <div className="mt-2 bg-white/95 backdrop-blur shadow-lg rounded-xl p-2 flex items-center gap-3 border border-gray-200 animate-fade-in-down">
                    {/* Color Picker */}
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                        {colors.map(c => (
                            <button
                                key={c}
                                onClick={() => setPenColor(c)}
                                className={`w-6 h-6 rounded-md border border-gray-300 ${penColor === c ? 'ring-2 ring-indigo-500 scale-110' : ''}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                    <div className="w-px h-4 bg-gray-300"></div>
                    {/* Size Slider */}
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-circle text-[8px] text-gray-400"></i>
                        <input 
                            type="range" 
                            min="2" 
                            max="30" 
                            value={penSize} 
                            onChange={(e) => setPenSize(parseInt(e.target.value))}
                            className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <i className="fa-solid fa-circle text-lg text-gray-400"></i>
                    </div>
                 </div>
            )}
        </div>

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
            onNodeContextMenu={handleNodeContextMenu}
        />

        <Chat onToolCall={handleToolCall} projectorMode={projectorMode} />

        {showSettings && (
            <SettingsModal 
                settings={settings} 
                onSave={setSettings} 
                onClose={() => setShowSettings(false)} 
            />
        )}
        
        {editingNode && (
            <EditNodeModal
                node={editingNode}
                onSave={handleEditNode}
                onClose={() => setEditingNode(null)}
            />
        )}
    </div>
  );
};

const App = () => (
    <ReactFlowProvider>
        <AppContent />
    </ReactFlowProvider>
);

export default App;