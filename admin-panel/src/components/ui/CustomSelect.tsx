import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface Option {
  id: string;
  name: string;
  [key: string]: any;
}

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: Option[];
  placeholder: string;
  renderOption?: (option: Option) => React.ReactNode;
  disabled?: boolean;
  className?: string;
  searchPlaceholder?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  renderOption,
  disabled,
  className = "",
  searchPlaceholder = "Search..."
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  
  const selectedOption = options.find(o => o.id === value);

  const filteredOptions = options.filter(option => {
    const searchTarget = (option.name || '').toLowerCase();
    return searchTarget.includes(search.toLowerCase());
  });

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset search when opening/closing
  useEffect(() => {
    if (!isOpen) setSearch('');
  }, [isOpen]);

  const defaultRender = (option: Option) => (
    <span className={`font-medium ${option.id === value ? 'text-coral' : 'text-gray-900'}`}>
      {option.name}
    </span>
  );

  const render = renderOption || defaultRender;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button 
        type="button"
        className={`w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-medium focus:border-coral focus:ring-1 focus:ring-coral/20 outline-none transition-all flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 text-gray-400' : 'text-gray-900'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        {selectedOption ? render(selectedOption) : <span className="text-gray-500">{placeholder}</span>}
        <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && !disabled && (
        <div className="absolute z-[100] w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-80 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-50 flex items-center gap-2 bg-gray-50/50">
            <Search size={14} className="text-gray-400 ml-2" />
            <input 
              autoFocus
              type="text"
              placeholder={searchPlaceholder}
              className="w-full px-2 py-2 bg-transparent border-transparent rounded-lg text-sm font-medium focus:outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div className="overflow-y-auto flex-1 max-h-60 scrollbar-thin scrollbar-thumb-gray-200">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors flex items-center last:border-0 ${option.id === value ? 'bg-coral/5' : 'hover:bg-gray-50'}`}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex-1">
                    {render(option)}
                  </div>
                  {option.id === value && (
                    <div className="w-1.5 h-1.5 rounded-full bg-coral ml-2" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-6 text-center text-gray-400 text-sm italic">
                No results found for "{search}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
