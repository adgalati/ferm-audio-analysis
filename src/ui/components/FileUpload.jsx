import React, { useState, useRef } from 'react';
import { Upload, File, Music } from 'lucide-react';

function FileUpload({ onFileSelect, disabled }) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileSelection({ path: file.path, name: file.name });
    }
  };

  const handleFileSelection = (fileInfo) => {
    onFileSelect(fileInfo);
  };

  const handleChooseFile = async () => {
    const fileInfo = await window.electronAPI.selectFile();
    if (fileInfo) {
      handleFileSelection(fileInfo);
    }
  };

  return (
    <div className="card">
      <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
        <Music className="w-6 h-6 text-primary-400" />
        Select Audio File
      </h2>

      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-500/10'
            : 'border-gray-600 hover:border-gray-500'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={!disabled ? handleChooseFile : undefined}
      >
        <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <p className="text-lg mb-2 text-gray-300">
          Drag and drop an audio file here
        </p>
        <p className="text-sm text-gray-500 mb-4">
          or click to browse
        </p>
        <button
          className="btn-primary"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            handleChooseFile();
          }}
        >
          Choose File
        </button>
        <p className="text-xs text-gray-600 mt-4">
          Supported formats: WAV, MP3, FLAC, OGG, M4A, AAC
        </p>
      </div>

      {/* Recent files removed (History panel covers this use-case) */}
    </div>
  );
}

export default FileUpload;
