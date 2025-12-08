import React, { useState, useEffect } from 'react';
import type { Node } from 'reactflow';
import { ElementData } from '../types';

interface EditNodeModalProps {
  node: Node<ElementData>;
  onSave: (id: string, data: Partial<ElementData>) => void;
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

  const renderField = () => {
    switch (node.type) {
      case 'note':
        return (
          <textarea
            value={data.content || ''}
            onChange={(e) => setData({ ...data, content: e.target.value })}
            className="w-full p-2 border rounded min-h-[100px]"
          />
        );
      case 'wordArt':
        return (
          <input
            type="text"
            value={data.text || ''}
            onChange={(e) => setData({ ...data, text: e.target.value })}
            className="w-full p-2 border rounded"
          />
        );
      case 'list':
          return (
             <>
                <input
                    type="text"
                    value={data.title || ''}
                    onChange={(e) => setData({ ...data, title: e.target.value })}
                    placeholder="List Title"
                    className="w-full p-2 border rounded mb-2"
                />
                <textarea
                    value={data.items?.join('\n') || ''}
                    onChange={(e) => setData({ ...data, items: e.target.value.split('\n') })}
                    className="w-full p-2 border rounded min-h-[100px]"
                    placeholder="One item per line"
                />
             </>
          );
      case 'image':
        return (
            <input
                type="text"
                value={data.url || ''}
                onChange={(e) => setData({ ...data, url: e.target.value })}
                placeholder="Image URL"
                className="w-full p-2 border rounded"
            />
        );
      default:
        return <p>This element type cannot be edited.</p>;
    }
  };

  return (
    <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">Edit {node.type}</h3>
        <div className="space-y-4">
            {renderField()}
            <div className="flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default EditNodeModal;
