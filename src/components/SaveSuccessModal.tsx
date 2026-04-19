import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

interface SaveSuccessModalProps {
  isOpen: boolean;
  entryId: string | null;
  onContinue: () => void;
}

export const SaveSuccessModal: React.FC<SaveSuccessModalProps> = ({ isOpen, entryId, onContinue }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Entry saved successfully</h2>
        <p className="text-gray-600 mb-6">What would you like to do next?</p>
        
        <div className="space-y-3">
          {entryId && (
            <button
              onClick={() => navigate(`/entry/${entryId}`)}
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              View Entry
            </button>
          )}
          <button
            onClick={onContinue}
            className="w-full py-2 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Continue Logging
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
