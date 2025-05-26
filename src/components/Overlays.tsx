
import React, { useState, useEffect } from 'react';
import { Profile, Playlist, ResumePlaybackModalState, ContentItem, RateContentModalState, EditProfileModalState, Page, FeedbackModalState, UpdateReadyModalState } from '../types';
import { DEFAULT_PROFILES, PREFERRED_AVATARS, LAUNCH_SECTIONS, DEFAULT_USER_ICON_ID, PREFERRED_AVATAR_BG_COLORS } from '../constants';
import { StarIcon, UserIcon, SpinnerIcon } from './common/Icons'; // Added SpinnerIcon
import { supabase } from '../supabaseClient'; 

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  titleId?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, titleId = "modal-title" }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="bg-sv-bg-deep rounded-xl border border-sv-border-glass shadow-2xl p-6 min-w-[400px] max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 id={titleId} className="text-xl font-bold text-sv-text-primary">{title}</h3>
          <button onClick={onClose} className="text-sv-text-secondary hover:text-sv-text-primary text-2xl" aria-label="Close modal">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
};


interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: Profile[];
  onSwitchProfile: (profileId: number) => void; 
}
const ProfileModalComponent: React.FC<ProfileModalProps> = ({ isOpen, onClose, profiles, onSwitchProfile }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Profile">
      <div className="space-y-3">
        {profiles.map(profile => (
           <div key={profile.id} 
                className={`p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-colors
                            ${profile.isActive ? 'bg-sv-accent-purple/20 ring-2 ring-sv-accent-purple' : 'bg-sv-glass-card backdrop-blur-sm border border-sv-border-glass hover:bg-sv-hover-bg'}`}
                onClick={() => { onSwitchProfile(profile.id); onClose();}} >
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${!profile.avatarBgColor ? 'bg-gradient-to-br from-sv-accent-cyan to-sv-accent-purple' : ''}`}
                  style={profile.avatarBgColor ? { backgroundColor: profile.avatarBgColor } : {}}
                >
                    {profile.avatar === DEFAULT_USER_ICON_ID ? <UserIcon className="w-5 h-5" /> : profile.avatar}
                </div>
                <span className={profile.isActive ? "text-sv-accent-purple font-semibold" : "text-sv-text-primary"}>{profile.name}</span>
           </div>
        ))}
         <div className="p-3 rounded-lg flex items-center gap-3 cursor-not-allowed bg-sv-glass-card backdrop-blur-sm border border-sv-border-glass opacity-50">
            <div className="w-8 h-8 rounded-full bg-sv-hover-bg flex items-center justify-center text-sm font-bold text-sv-text-secondary">
                +
            </div>
            <span className="text-sv-text-secondary">Add New Profile</span>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 bg-sv-glass-search backdrop-blur-md border border-sv-border-glass text-sv-text-primary rounded-lg hover:bg-opacity-70 transition-all font-medium">Cancel</button>
      </div>
    </Modal>
  );
};


interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlaylist: (type: 'm3u' | 'xtream', details: any) => void;
}
const PlaylistModalComponent: React.FC<PlaylistModalProps> = ({ isOpen, onClose, onAddPlaylist }) => {
  const [connectionType, setConnectionType] = useState<'m3u' | 'xtream'>('m3u');
  const [m3uInputMethod, setM3uInputMethod] = useState<'url' | 'file'>('url');
  const [m3uName, setM3uName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [m3uFile, setM3uFile] = useState<File | null>(null);
  const [xtreamName, setXtreamName] = useState('');
  const [xtreamServerUrl, setXtreamServerUrl] = useState('');
  const [xtreamUsername, setXtreamUsername] = useState('');
  const [xtreamPassword, setXtreamPassword] = useState('');

  const resetM3uFields = () => {
    setM3uName('');
    setM3uUrl('');
    setM3uFile(null);
    setM3uInputMethod('url');
  };

  const resetXtreamFields = () => {
    setXtreamName('');
    setXtreamServerUrl('');
    setXtreamUsername('');
    setXtreamPassword('');
  };

  const handleSubmit = () => {
    if (connectionType === 'm3u') {
      if (m3uInputMethod === 'file' && m3uFile) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const fileContent = event.target?.result as string;
          onAddPlaylist('m3u', { name: m3uName || m3uFile.name, m3uFileContent: fileContent });
          resetM3uFields();
          onClose();
        };
        reader.onerror = () => {
            console.error("Error reading file.");
            alert("Error reading file. Please try again.");
        };
        reader.readAsText(m3uFile);
      } else if (m3uInputMethod === 'url') {
        onAddPlaylist('m3u', { name: m3uName, url: m3uUrl });
        resetM3uFields();
        onClose();
      } else {
        alert("For M3U, please provide a URL or upload a file.");
        return;
      }
    } else { // Xtream Codes
      onAddPlaylist('xtream', { name: xtreamName, serverUrl: xtreamServerUrl, username: xtreamUsername, password: xtreamPassword });
      resetXtreamFields();
      onClose();
    }
  };
  
  const commonInputClass = "w-full bg-[#1A1E2C] border border-sv-border-glass rounded-lg p-2.5 text-sv-text-primary placeholder-sv-text-secondary/70 focus:border-sv-accent-cyan focus:ring-1 focus:ring-sv-accent-cyan outline-none text-sm transition-all duration-200";
  const commonLabelClass = "block text-sm font-medium text-sv-text-secondary mb-1.5";
  const radioLabelClass = "mr-4 flex items-center text-sm text-sv-text-secondary cursor-pointer";
  const radioInputClass = "mr-1.5 focus:ring-1 focus:ring-sv-accent-cyan h-4 w-4 text-sv-accent-cyan border-sv-border-glass bg-transparent";

  const arrowSvgDefault = "data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%23A0A0B8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.293%207.293a1%201%200%20011.414%200L10%2010.586l3.293-3.293a1%201%200%20111.414%201.414l-4%204a1%201%200%2001-1.414%200l-4-4a1%201%200%20010-1.414z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E";
  const arrowSvgFocus = "data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2300F0FF%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.293%207.293a1%201%200%20011.414%200L10%2010.586l3.293-3.293a1%201%200%20111.414%201.414l-4%204a1%201%200%2001-1.414%200l-4-4a1%201%200%20010-1.414z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E";

  return (
    <Modal isOpen={isOpen} onClose={() => {
        resetM3uFields();
        resetXtreamFields();
        onClose();
    }} title="Add IPTV Source" titleId="playlist-modal-title">
      <div className="space-y-4">
        <div>
          <label htmlFor="connection-type" className={commonLabelClass}>Connection Type</label>
          <select 
            id="connection-type" 
            value={connectionType} 
            onChange={(e) => setConnectionType(e.target.value as 'm3u' | 'xtream')}
            className={`${commonInputClass} appearance-none bg-no-repeat bg-[position:right_12px_center] bg-[length:16px_16px] bg-[url('${arrowSvgDefault}')] focus:bg-[url('${arrowSvgFocus}')]`}
          >
            <option value="m3u" className="bg-[#1A1E2C] text-sv-text-primary">M3U Playlist</option>
            <option value="xtream" className="bg-[#1A1E2C] text-sv-text-primary">Xtream Codes Portal</option>
          </select>
        </div>

        {connectionType === 'm3u' && (
          <>
            <div>
              <label htmlFor="m3u-playlist-name" className={commonLabelClass}>Playlist Name</label>
              <input type="text" id="m3u-playlist-name" value={m3uName} onChange={(e) => setM3uName(e.target.value)} placeholder="My IPTV Service (Optional for file upload)" className={commonInputClass} />
            </div>
            <div className="my-3">
                <span className={commonLabelClass}>M3U Source Method</span>
                <div className="flex mt-1.5">
                    <label className={radioLabelClass}>
                        <input type="radio" name="m3uMethod" value="url" checked={m3uInputMethod === 'url'} onChange={() => setM3uInputMethod('url')} className={radioInputClass}/>
                        URL
                    </label>
                    <label className={radioLabelClass}>
                        <input type="radio" name="m3uMethod" value="file" checked={m3uInputMethod === 'file'} onChange={() => setM3uInputMethod('file')} className={radioInputClass}/>
                        Upload File
                    </label>
                </div>
            </div>

            {m3uInputMethod === 'url' && (
                <div>
                    <label htmlFor="m3u-url" className={commonLabelClass}>M3U URL</label>
                    <input type="url" id="m3u-url" value={m3uUrl} onChange={(e) => setM3uUrl(e.target.value)} placeholder="http://example.com/playlist.m3u8" className={commonInputClass} />
                </div>
            )}
            {m3uInputMethod === 'file' && (
                 <div>
                    <label htmlFor="m3u-file" className={commonLabelClass}>Upload .m3u or .m3u8 File</label>
                    <input 
                        type="file" 
                        id="m3u-file" 
                        accept=".m3u,.m3u8"
                        onChange={(e) => setM3uFile(e.target.files ? e.target.files[0] : null)} 
                        className={`${commonInputClass} file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-sv-accent-cyan file:text-sv-bg-deep hover:file:bg-opacity-80`} 
                    />
                </div>
            )}
          </>
        )}

        {connectionType === 'xtream' && (
          <>
            <div>
              <label htmlFor="xtream-service-name" className={commonLabelClass}>Service Name</label>
              <input type="text" id="xtream-service-name" value={xtreamName} onChange={(e) => setXtreamName(e.target.value)} placeholder="My IPTV Provider" className={commonInputClass} />
            </div>
            <div>
              <label htmlFor="xtream-server-url" className={commonLabelClass}>Server URL (e.g., http://server.com:port)</label>
              <input type="url" id="xtream-server-url" value={xtreamServerUrl} onChange={(e) => setXtreamServerUrl(e.target.value)} placeholder="http://server.com:port" className={commonInputClass} />
            </div>
            <div>
              <label htmlFor="xtream-username" className={commonLabelClass}>Username</label>
              <input type="text" id="xtream-username" value={xtreamUsername} onChange={(e) => setXtreamUsername(e.target.value)} placeholder="username" className={commonInputClass} />
            </div>
            <div>
              <label htmlFor="xtream-password" className={commonLabelClass}>Password</label>
              <input type="password" id="xtream-password" value={xtreamPassword} onChange={(e) => setXtreamPassword(e.target.value)} placeholder="password" className={commonInputClass} />
            </div>
          </>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={() => {
            resetM3uFields();
            resetXtreamFields();
            onClose();
        }} className="px-5 py-2.5 bg-sv-glass-search backdrop-blur-md border border-sv-border-glass text-sv-text-primary rounded-lg hover:bg-opacity-70 transition-all font-medium">Cancel</button>
        <button onClick={handleSubmit} className="px-5 py-2.5 bg-gradient-to-r from-sv-accent-cyan to-sv-accent-purple text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-lg">Connect</button>
      </div>
    </Modal>
  );
};

interface MessageBoxProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}
const MessageBoxComponent: React.FC<MessageBoxProps> = ({ isOpen, title, message, onClose }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} titleId="message-box-title">
      <div className="text-center">
        <p className="text-sm text-sv-text-secondary mb-6 whitespace-pre-wrap">{message}</p>
        <button 
          onClick={onClose}
          className="px-6 py-2 bg-gradient-to-r from-sv-accent-cyan to-sv-accent-purple text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
        >
          OK
        </button>
      </div>
    </Modal>
  );
};

interface LoadingOverlayProps {
  isLoading: boolean;
  message: string;
}
const LoadingOverlayComponent: React.FC<LoadingOverlayProps> = ({ isLoading, message }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center z-[70] text-sv-text-primary"
      role="alertdialog" 
      aria-busy="true"
      aria-live="assertive"
      aria-label="Loading content"
    >
      <div className="w-10 h-10 border-4 border-sv-text-primary/30 border-t-sv-accent-cyan rounded-full animate-spin mb-4"></div>
      <p className="text-lg">{message}</p>
    </div>
  );
};

const formatTime = (timeInSeconds: number): string => {
  if (isNaN(timeInSeconds) || timeInSeconds < 0) return "00:00";
  const totalSeconds = Math.floor(timeInSeconds);
  
  if (totalSeconds >= 3600) { // If 1 hour or more
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
};

interface ResumePlaybackModalProps {
  modalState: ResumePlaybackModalState;
  onClose: () => void;
  onResume: (item: ContentItem, time: number) => void;
  onStartOver: (item: ContentItem) => void;
}
const ResumePlaybackModalComponent: React.FC<ResumePlaybackModalProps> = ({ modalState, onClose, onResume, onStartOver }) => {
  if (!modalState.isOpen || !modalState.item) return null;

  const { item, savedTime } = modalState;

  const handleResume = () => {
    onResume(item, savedTime);
  };

  const handleStartOver = () => {
    onStartOver(item);
  };

  return (
    <Modal isOpen={modalState.isOpen} onClose={onClose} title="Resume Playback?" titleId="resume-playback-modal-title">
      <div className="text-center">
        <p className="text-sm text-sv-text-secondary mb-2">
          Continue watching <strong className="text-sv-text-primary font-semibold">{item.name}</strong>
        </p>
        <p className="text-sm text-sv-text-secondary mb-6">
          from <strong className="text-sv-text-primary font-semibold">{formatTime(savedTime)}</strong> or start over?
        </p>
        <div className="flex justify-center gap-8 mt-6">
          <button
            onClick={handleStartOver}
            className="text-sv-text-primary hover:text-sv-accent-cyan font-medium transition-colors py-2"
          >
            Start Over
          </button>
          <button
            onClick={handleResume}
            className="text-sv-text-primary hover:text-sv-accent-cyan font-semibold transition-colors py-2"
          >
            Resume
          </button>
        </div>
      </div>
    </Modal>
  );
};

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}
const ConfirmDeleteModalComponent: React.FC<ConfirmDeleteModalProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} titleId="confirm-delete-modal-title">
      <div className="text-center">
        <p className="text-sm text-sv-text-secondary mb-6 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-center gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 bg-sv-glass-search backdrop-blur-md border border-sv-border-glass text-sv-text-primary rounded-lg hover:bg-opacity-70 transition-all font-medium"
          >
            No
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 bg-sv-danger text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            Yes
          </button>
        </div>
      </div>
    </Modal>
  );
};


interface RateContentModalProps {
  modalState: RateContentModalState;
  onClose: () => void;
  onSaveRating: (itemId: string, rating: number) => void;
}
const RateContentModalComponent: React.FC<RateContentModalProps> = ({ modalState, onClose, onSaveRating }) => {
  const [currentRating, setCurrentRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  React.useEffect(() => {
    if (modalState.item?.userRating) {
      setCurrentRating(modalState.item.userRating);
    } else {
      setCurrentRating(0);
    }
    setHoverRating(0);
  }, [modalState.item]);

  if (!modalState.isOpen || !modalState.item) return null;

  const handleSave = () => {
    if (currentRating > 0) {
      onSaveRating(modalState.item!.id, currentRating);
    }
    onClose();
  };

  return (
    <Modal isOpen={modalState.isOpen} onClose={onClose} title={`Rate: ${modalState.item.name}`} titleId="rate-content-modal-title">
      <div className="text-center">
        <p className="text-sm text-sv-text-secondary mb-4">Select your rating (1-10 stars):</p>
        <div className="flex justify-center items-center space-x-1 mb-6" role="radiogroup" aria-label="Rating">
          {[...Array(10)].map((_, index) => {
            const ratingValue = index + 1;
            return (
              <button
                key={ratingValue}
                className={`p-1 rounded-full transition-colors focus:outline-none 
                            ${(hoverRating || currentRating) >= ratingValue ? 'text-sv-warning' : 'text-sv-text-secondary/50 hover:text-sv-warning/70'}`}
                onClick={() => setCurrentRating(ratingValue)}
                onMouseEnter={() => setHoverRating(ratingValue)}
                onMouseLeave={() => setHoverRating(0)}
                aria-label={`${ratingValue} star${ratingValue > 1 ? 's' : ''}`}
                aria-checked={(hoverRating || currentRating) === ratingValue}
                role="radio"
              >
                <StarIcon className="w-6 h-6" isFilled={(hoverRating || currentRating) >= ratingValue} />
              </button>
            );
          })}
        </div>
        <div className="flex justify-center gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-sv-glass-search backdrop-blur-md border border-sv-border-glass text-sv-text-primary rounded-lg hover:bg-opacity-70 transition-all font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={currentRating === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-sv-accent-cyan to-sv-accent-purple text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Rating
          </button>
        </div>
      </div>
    </Modal>
  );
};

interface EditProfileModalProps {
  modalState: EditProfileModalState;
  onClose: () => void;
  onSaveProfile: (updatedProfile: Profile) => void;
}
const EditProfileModalComponent: React.FC<EditProfileModalProps> = ({ modalState, onClose, onSaveProfile }) => {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [selectedAvatarBgColor, setSelectedAvatarBgColor] = useState<string | undefined>(undefined);


  useEffect(() => {
    if (modalState.isOpen && modalState.profile) {
      setName(modalState.profile.name);
      setSelectedAvatar(modalState.profile.avatar);
      setSelectedAvatarBgColor(modalState.profile.avatarBgColor || PREFERRED_AVATAR_BG_COLORS[0]);
    }
  }, [modalState]);

  if (!modalState.isOpen || !modalState.profile) return null;

  const handleSave = () => {
    const updatedProfile: Profile = {
      ...modalState.profile!,
      name: name.trim() || modalState.profile!.name, 
      avatar: selectedAvatar,
      avatarBgColor: selectedAvatarBgColor,
    };
    onSaveProfile(updatedProfile);
    onClose();
  };
  
  const commonInputClass = "w-full bg-[#1A1E2C] border border-sv-border-glass rounded-lg p-2.5 text-sv-text-primary placeholder-sv-text-secondary/70 focus:border-sv-accent-cyan focus:ring-1 focus:ring-sv-accent-cyan outline-none text-sm transition-all duration-200";
  const commonLabelClass = "block text-sm font-medium text-sv-text-secondary mb-1.5";

  return (
    <Modal isOpen={modalState.isOpen} onClose={onClose} title="Edit Profile" titleId="edit-profile-modal-title">
      <div className="space-y-5">
        <div>
          <label htmlFor="profile-name" className={commonLabelClass}>Profile Name</label>
          <input
            type="text"
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={commonInputClass}
            placeholder="Enter profile name"
            aria-required="true"
          />
        </div>
        <div>
          <label className={commonLabelClass}>Avatar</label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select avatar">
            {PREFERRED_AVATARS.map(avatar => (
              <button
                key={avatar}
                type="button"
                onClick={() => setSelectedAvatar(avatar)}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all
                            ${selectedAvatar === avatar 
                              ? 'ring-2 ring-offset-2 ring-offset-sv-bg-deep ring-sv-accent-cyan' 
                              : 'bg-sv-glass-search text-sv-text-primary hover:bg-sv-hover-bg'}`}
                style={selectedAvatar === avatar && selectedAvatarBgColor ? { backgroundColor: selectedAvatarBgColor } : {}}
                aria-label={`Select avatar ${avatar === DEFAULT_USER_ICON_ID ? 'Default User Icon' : avatar }`}
                aria-checked={selectedAvatar === avatar}
                role="radio"
              >
                {avatar === DEFAULT_USER_ICON_ID ? <UserIcon className="w-5 h-5" /> : avatar}
              </button>
            ))}
          </div>
        </div>

        <div>
            <label className={commonLabelClass}>Avatar Background Color</label>
            <div className="flex flex-wrap gap-2 mt-1.5" role="radiogroup" aria-label="Select avatar background color">
                {PREFERRED_AVATAR_BG_COLORS.map(bgColor => (
                    <button
                        key={bgColor}
                        type="button"
                        onClick={() => setSelectedAvatarBgColor(bgColor)}
                        className={`w-8 h-8 rounded-full border-2 transition-all
                                    ${selectedAvatarBgColor === bgColor
                                        ? 'ring-2 ring-offset-2 ring-offset-sv-bg-deep ring-sv-accent-cyan' 
                                        : 'border-sv-border-glass hover:border-sv-accent-cyan/70'
                                    }`}
                        style={{ backgroundColor: bgColor }}
                        aria-label={`Select background color ${bgColor}`}
                        aria-checked={selectedAvatarBgColor === bgColor}
                        role="radio"
                    >
                         {selectedAvatarBgColor === bgColor && <span className="text-xs text-white mix-blend-difference">✓</span>}
                    </button>
                ))}
                 <button // Option to revert to default gradient
                    type="button"
                    onClick={() => setSelectedAvatarBgColor(undefined)}
                    className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center
                                ${selectedAvatarBgColor === undefined
                                    ? 'ring-2 ring-offset-2 ring-offset-sv-bg-deep ring-sv-accent-cyan'
                                    : 'border-sv-border-glass hover:border-sv-accent-cyan/70'
                                } bg-gradient-to-br from-sv-accent-cyan to-sv-accent-purple`}
                    aria-label="Select default gradient background"
                    aria-checked={selectedAvatarBgColor === undefined}
                    role="radio"
                >
                  {selectedAvatarBgColor === undefined && <span className="text-xs text-white">✓</span>}
                </button>
            </div>
        </div>
      </div>
      <div className="mt-8 flex justify-end gap-3">
        <button onClick={onClose} className="px-5 py-2.5 bg-sv-glass-search backdrop-blur-md border border-sv-border-glass text-sv-text-primary rounded-lg hover:bg-opacity-70 transition-all font-medium">
          Cancel
        </button>
        <button onClick={handleSave} className="px-5 py-2.5 bg-gradient-to-r from-sv-accent-cyan to-sv-accent-purple text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-lg">
          Save Changes
        </button>
      </div>
    </Modal>
  );
};

interface FeedbackModalProps {
  modalState: FeedbackModalState;
  onClose: () => void;
}
const FeedbackModalComponent: React.FC<FeedbackModalProps> = ({ modalState, onClose }) => {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim()) {
      setStatus('Please enter your feedback.');
      return;
    }
    setIsSubmitting(true);
    setStatus(null);

    try {
      const { error } = await supabase.from('feedback').insert([{ message: message.trim() }]);
      if (error) {
        console.error('Supabase error:', error);
        setStatus('❌ Failed to send feedback. Please try again.');
      } else {
        setStatus('✅ Feedback sent successfully! Thank you.');
        setMessage('');
        setTimeout(() => {
            onClose();
            setStatus(null); 
        }, 2000);
      }
    } catch (error) {
        console.error('General error submitting feedback:', error);
        setStatus('❌ An unexpected error occurred. Please try again.');
    } finally {
        setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!modalState.isOpen) {
        setMessage('');
        setStatus(null);
        setIsSubmitting(false);
    }
  }, [modalState.isOpen]);

  const commonTextareaClass = "w-full bg-[#1A1E2C] border border-sv-border-glass rounded-lg p-3 text-sv-text-primary placeholder-sv-text-secondary/70 focus:border-sv-accent-cyan focus:ring-1 focus:ring-sv-accent-cyan outline-none text-sm transition-all duration-200 resize-none";
  const commonLabelClass = "block text-sm font-medium text-sv-text-secondary mb-1.5";

  return (
    <Modal isOpen={modalState.isOpen} onClose={onClose} title="Send Feedback" titleId="feedback-modal-title">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="feedback-message" className={commonLabelClass}>Your Feedback</label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what you think..."
            className={commonTextareaClass}
            rows={5}
            required
            disabled={isSubmitting}
            aria-required="true"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !message.trim()}
          className="w-full px-5 py-2.5 bg-gradient-to-r from-sv-accent-cyan to-sv-accent-purple text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? <SpinnerIcon className="w-5 h-5 mx-auto" /> : 'Send Feedback'}
        </button>
        {status && (
          <p 
            className={`text-sm mt-3 p-2 rounded-md text-center ${status.startsWith('✅') ? 'bg-sv-success/20 text-sv-success' : 'bg-sv-danger/20 text-sv-danger'}`}
            role="alert"
          >
            {status}
          </p>
        )}
      </form>
    </Modal>
  );
};

// New Update Ready Modal
interface UpdateReadyModalProps {
  modalState: UpdateReadyModalState;
  onClose: () => void; // "Later" action
  onRestart: () => void; // "Restart Now" action
}
const UpdateReadyModalComponent: React.FC<UpdateReadyModalProps> = ({ modalState, onClose, onRestart }) => {
  if (!modalState.isOpen) return null;

  return (
    <Modal isOpen={modalState.isOpen} onClose={onClose} title="Update Ready" titleId="update-ready-modal-title">
      <div className="text-center">
        <p className="text-sm text-sv-text-secondary mb-6">
          A new version of StreamVault has been downloaded. Restart the application to apply the update.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-sv-glass-search backdrop-blur-md border border-sv-border-glass text-sv-text-primary rounded-lg hover:bg-opacity-70 transition-all font-medium"
          >
            Later
          </button>
          <button
            onClick={onRestart}
            className="px-6 py-2.5 bg-gradient-to-r from-sv-accent-cyan to-sv-accent-purple text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-lg"
          >
            Restart Now
          </button>
        </div>
      </div>
    </Modal>
  );
};


export { 
    ProfileModalComponent as ProfileModal,
    PlaylistModalComponent as PlaylistModal,
    MessageBoxComponent as MessageBox,
    LoadingOverlayComponent as LoadingOverlay,
    ResumePlaybackModalComponent as ResumePlaybackModal,
    ConfirmDeleteModalComponent as ConfirmDeleteModal,
    RateContentModalComponent as RateContentModal,
    EditProfileModalComponent as EditProfileModal,
    FeedbackModalComponent as FeedbackModal,
    UpdateReadyModalComponent as UpdateReadyModal // New export
};
