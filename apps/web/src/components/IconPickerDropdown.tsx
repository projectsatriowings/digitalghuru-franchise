import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Search as SearchIcon,
  Star,
  BrainCircuit,
  Users,
  Target,
  Rocket,
  CheckCircle,
  Search,
  Laptop2,
  TrendingUp,
  RefreshCcw,
  Cpu,
  DollarSign,
  PenTool,
  FolderOpen,
  Video,
  Award,
  BookOpen,
  Clock,
  Heart,
  MessageCircle,
  BarChart,
  Code,
  Database,
  Compass,
  Smartphone,
  Server,
  FileText,
  Briefcase,
  Zap,
  Layers,
  Layout,
  Monitor,
  LineChart,
  PieChart,
  User,
  Sparkles,
  Globe,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Star,
  BrainCircuit,
  Users,
  Target,
  Rocket,
  CheckCircle,
  Search,
  Laptop2,
  TrendingUp,
  RefreshCcw,
  Cpu,
  DollarSign,
  PenTool,
  FolderOpen,
  Video,
  Award,
  BookOpen,
  Clock,
  Heart,
  MessageCircle,
  BarChart,
  Code,
  Database,
  Compass,
  Smartphone,
  Server,
  FileText,
  Briefcase,
  Zap,
  Layers,
  Layout,
  Monitor,
  LineChart,
  PieChart,
  User,
  Sparkles,
  Globe,
};

const COMMON_ICONS = Object.keys(ICON_MAP);

export const IconRenderer: React.FC<{ name?: string; className?: string }> = ({
  name = 'Star',
  className = 'h-4 w-4',
}) => {
  const IconComp = ICON_MAP[name] || Star;
  return <IconComp className={className} />;
};

interface IconPickerDropdownProps {
  value: string;
  onChange: (iconName: string) => void;
  className?: string;
}

export const IconPickerDropdown: React.FC<IconPickerDropdownProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredIcons = COMMON_ICONS.filter((name) =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#006FFF] text-left"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <IconRenderer name={value || 'Star'} className="h-4 w-4 text-[#006FFF] shrink-0" />
          <span className="text-sm text-slate-800 truncate">{value || 'Select Icon'}</span>
        </div>
        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-64 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2">
            <SearchIcon className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search icons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent text-slate-800"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto p-1.5 flex-1">
            {filteredIcons.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">No icons found</div>
            ) : (
              <div className="grid grid-cols-4 gap-1">
                {filteredIcons.map((iconName) => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => {
                      onChange(iconName);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    title={iconName}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                      value === iconName
                        ? 'bg-[#006FFF]/10 text-[#006FFF]'
                        : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <IconRenderer name={iconName} className="h-4 w-4 mb-1" />
                    <span className="text-[9px] w-full text-center truncate">{iconName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IconPickerDropdown;

