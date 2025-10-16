import { User, UserCircle } from 'lucide-react';

interface VoiceSelectorProps {
  value: 'male' | 'female';
  onChange: (value: 'male' | 'female') => void;
}

export function VoiceSelector({ value, onChange }: VoiceSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700">Voice:</label>
      <div className="flex bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => onChange('male')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${
            value === 'male'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <User className="w-4 h-4" />
          <span className="text-sm font-medium">Male</span>
        </button>
        <button
          onClick={() => onChange('female')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${
            value === 'female'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <UserCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Female</span>
        </button>
      </div>
    </div>
  );
}
