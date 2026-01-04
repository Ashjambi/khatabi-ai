
import React, { useState, useRef, useEffect } from 'react';

interface MultiSelectComboboxProps {
    options: string[];
    selectedItems: string[];
    onChange: (newItems: string[]) => void;
    placeholder?: string;
    ringColor: string;
    disabled?: boolean;
}

const MultiSelectCombobox: React.FC<MultiSelectComboboxProps> = ({ options, selectedItems, onChange, placeholder, ringColor, disabled = false }) => {
    const [inputValue, setInputValue] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredOptions = options.filter(
        option =>
            !selectedItems.includes(option) &&
            option.toLowerCase().includes(inputValue.toLowerCase())
    );

    const handleAddItem = (item: string) => {
        if (item.trim() && !selectedItems.includes(item.trim())) {
            onChange([...selectedItems, item.trim()]);
        }
        setInputValue('');
        setIsDropdownOpen(false);
    };

    const handleRemoveItem = (itemToRemove: string) => {
        onChange(selectedItems.filter(item => item !== itemToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            e.preventDefault();
            if (filteredOptions.length > 0) {
                handleAddItem(filteredOptions[0]);
            } else {
                handleAddItem(inputValue);
            }
        } else if (e.key === 'Backspace' && inputValue === '' && selectedItems.length > 0) {
            handleRemoveItem(selectedItems[selectedItems.length - 1]);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div ref={containerRef} className="relative">
            <div className={`flex flex-wrap gap-2 items-center p-2 bg-slate-950/50 border border-slate-700/50 rounded-md shadow-inner ${disabled ? 'opacity-50 cursor-not-allowed' : `focus-within:outline-none focus-within:ring-2 ${ringColor}`}`}>
                {selectedItems.map(item => (
                    <span key={item} className="flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 text-sm font-medium px-2 py-1 rounded-full border border-indigo-500/30">
                        {item}
                        {!disabled && (
                            <button type="button" onClick={() => handleRemoveItem(item)} className="text-indigo-400 hover:text-indigo-200 font-bold ml-1">
                                X
                            </button>
                        )}
                    </span>
                ))}
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="flex-grow bg-transparent p-1 focus:outline-none min-w-[120px] text-white placeholder-slate-500"
                    disabled={disabled}
                />
            </div>
            {isDropdownOpen && !disabled && (filteredOptions.length > 0 || (inputValue.trim() && !filteredOptions.some(o => o.toLowerCase() === inputValue.trim().toLowerCase()))) && (
                <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-white/10 rounded-md shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                    <ul>
                        {filteredOptions.map(option => (
                            <li
                                key={option}
                                onClick={() => handleAddItem(option)}
                                className="px-4 py-2 text-sm text-slate-300 cursor-pointer hover:bg-white/10"
                            >
                                {option}
                            </li>
                        ))}
                        {inputValue.trim() && !options.some(o => o.toLowerCase() === inputValue.trim().toLowerCase()) && !selectedItems.includes(inputValue.trim()) && (
                             <li
                                onClick={() => handleAddItem(inputValue)}
                                className="px-4 py-2 text-sm text-emerald-400 cursor-pointer hover:bg-white/10"
                            >
                                إضافة: <span className="font-bold">"{inputValue}"</span>
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default MultiSelectCombobox;
