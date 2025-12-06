
import React, { useState, useEffect } from 'react';
import { Node } from 'reactflow';
import { ElementData } from '../types';

interface EditNodeModalProps {
  node: Node<ElementData>;
  onSave: (id: string, newData: Partial<ElementData>) => void;
  onClose: () => void;
}

const EditNodeModal: React.FC<EditNodeModalProps> = ({ node, onSave, onClose }) => {
  const [data, setData] = useState(node.data);

  useEffect(() => {
      setData(node.data);
  }, [node]);

  const handleSave = () => {
    onSave(node.id, data);
    onClose();
  };

  const renderInputs = () => {
      switch (node.type) {
          case 'note':
              return (
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                          <textarea 
                              value={data.content || ''}
                              onChange={e => setData({...data, content: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                          <input 
                              type="color" 
                              value={data.color || '#fff740'}
                              onChange={e => setData({...data, color: e.target.value})}
                              className="w-full h-10 p-1 rounded cursor-pointer"
                          />
                      </div>
                  </div>
              );
          case 'wordArt':
              return (
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Text</label>
                          <input 
                              type="text"
                              value={data.text || ''}
                              onChange={e => setData({...data, text: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                          <input 
                              type="color" 
                              value={data.color || '#e17055'}
                              onChange={e => setData({...data, color: e.target.value})}
                              className="w-full h-10 p-1 rounded cursor-pointer"
                          />
                      </div>
                  </div>
              );
          case 'image':
              return (
                   <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                          <input 
                              type="text"
                              value={data.url || ''}
                              onChange={e => setData({...data, url: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <input 
                              type="text"
                              value={data.description || ''}
                              onChange={e => setData({...data, description: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                      </div>
                  </div>
              );
          case 'list':
              return (
                   <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                          <input 
                              type="text"
                              value={data.title || ''}
                              onChange={e => setData({...data, title: e.target.value})}
                              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                      </div>
                  </div>
              );
          default:
              return <p className="text-gray-500">Editing properties for this element type is not fully supported yet.</p>;
      }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 animate-fade-in-up">
        <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
          <h2 className="text-lg font-bold flex items-center gap-2 capitalize">
            <i className="fa-solid fa-pen-to-square"></i> Edit {node.type}
          </h2>
          <button onClick={onClose} className="hover:bg-indigo-700 p-1 rounded-full transition"><i className="fa-solid fa-xmark"></i></button>
        </div>
        
        <div className="p-6">
            {renderInputs()}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow hover:bg-indigo-700 transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditNodeModal;
