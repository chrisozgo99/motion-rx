import React, { useState } from 'react';

interface ConversationHistoryProps {
  history: Array<{ role: string; content: string }>;
}

const ConversationHistory: React.FC<ConversationHistoryProps> = ({ history }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 w-64 bg-white shadow-lg rounded-lg overflow-hidden z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        <span className="font-medium">Conversation History</span>
        <span className="text-xl">{isOpen ? '▼' : '▲'}</span>
      </button>
      {isOpen && (
        <div className="max-h-96 overflow-y-auto p-4 bg-opacity-100 bg-white backdrop-blur-sm">
          {history.map((item, index) => (
            <div key={index} className="mb-2 bg-white">
              <span className="font-bold">{item.role === 'assistant' ? 'Doctor: ' : 'You: '}</span>
              <span>{item.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConversationHistory;
