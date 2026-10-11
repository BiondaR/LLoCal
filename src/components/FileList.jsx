export default function FileList({ files, onRemove, onMove }) {
  return (
    <div className="w-full max-h-60 overflow-y-auto pr-2 custom-scrollbar">
      <div className="space-y-2">
        {files.map((file, index) => (
          <div key={index} className="flex items-center justify-between bg-[#222] p-3 border border-[#333] rounded-sm">
            <span className="text-xs truncate max-w-[70%] text-[#BBD2DE]">{file.name}</span>
            <div className="flex gap-3 items-center">
              <button onClick={() => onMove(index, -1)} className="text-[#FD9FFF] text-xs hover:bg-[#333] px-1">↑</button>
              <button onClick={() => onMove(index, 1)} className="text-[#FD9FFF] text-xs hover:bg-[#333] px-1">↓</button>
              <button onClick={() => onRemove(index)} className="text-red-400 text-xs font-bold ml-2">X</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}