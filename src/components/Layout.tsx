
import React, { useState } from 'react';
import { Page, Profile, NavigationItem } from '../types';
import { NAVIGATION_ITEMS, DEFAULT_PROFILES, DEFAULT_USER_ICON_ID } from '../constants';
import { SearchIcon, UserIcon } from './common/Icons'; // UserIcon can be a fallback

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  return (
    <nav className="w-72 bg-sv-glass-sidebar backdrop-blur-lg border-r border-sv-border-glass p-5 overflow-y-auto flex-shrink-0 shadow-2xl">
      <div className="flex items-center gap-3 mb-10 p-2.5">
        {/* Icon removed as per image, StreamVault text is primary */}
        <div className="text-2xl font-bold bg-gradient-to-r from-sv-accent-cyan to-sv-accent-purple bg-clip-text text-transparent">StreamVault</div>
      </div>
      <ul className="space-y-2.5">
        {NAVIGATION_ITEMS.map((item) => (
          <li key={item.id}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onNavigate(item.id);
              }}
              className={`relative flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sv-text-secondary transition-all duration-300 ease-in-out group
                ${currentPage === item.id 
                  ? 'bg-gradient-to-r from-sv-accent-gradient-from to-sv-accent-gradient-to text-white font-semibold shadow-glow-cyan-nav' 
                  : 'hover:bg-sv-hover-bg hover:text-sv-text-primary'}`}
                  aria-current={currentPage === item.id ? "page" : undefined}
            >
              <item.icon className="w-5 h-5 opacity-90 group-hover:opacity-100" />
              <span className="tracking-wide">{item.label}</span>
              {currentPage === item.id && (
                <div className="absolute left-0 top-0 h-full w-1 bg-sv-accent-cyan rounded-r-md animate-pulse"></div>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

interface HeaderProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  profiles: Profile[]; 
  isFirstPlaylistAdded?: boolean; // New prop
}

export const Header: React.FC<HeaderProps> = ({ searchTerm, onSearchTermChange, profiles, isFirstPlaylistAdded }) => {
  const activeProfile = profiles.find(p => p.isActive) || profiles[0] || DEFAULT_PROFILES[0];

  return (
    <header className="px-8 py-5 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center bg-sv-glass-search backdrop-blur-md border border-sv-border-glass rounded-full py-2.5 px-5 min-w-[350px] shadow-md">
        <SearchIcon className="text-sv-text-secondary w-4.5 h-4.5 mr-2" />
        <input
          type="search"
          className="bg-transparent border-none text-sv-text-primary text-sm w-full px-2 py-1 outline-none placeholder-sv-text-secondary focus:ring-0"
          placeholder="Search movies, series, channels..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          aria-label="Search content"
        />
      </div>
      {isFirstPlaylistAdded && ( // Conditionally render profile section
        <div className="flex items-center gap-4">
          <div 
            className="flex items-center gap-2.5 bg-sv-glass-search backdrop-blur-md border border-sv-border-glass px-3 py-2 rounded-full cursor-default shadow-md"
            // onClick might be added later for profile switching modal
          >
            <div 
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white ${!activeProfile.avatarBgColor ? 'bg-gradient-to-br from-sv-accent-cyan to-sv-accent-purple' : ''}`}
              style={activeProfile.avatarBgColor ? { backgroundColor: activeProfile.avatarBgColor } : {}}
            >
              {activeProfile.avatar === DEFAULT_USER_ICON_ID ? 
                <UserIcon className="w-4 h-4 text-white" /> : 
                activeProfile.avatar || <UserIcon className="w-4 h-4 text-white" /> 
              }
            </div>
            <span className="text-sm text-sv-text-primary font-medium">{activeProfile.name}</span>
            {/* ChevronDownIcon removed as per image, profile is not clickable for switching in this iteration */}
          </div>
        </div>
      )}
    </header>
  );
};
