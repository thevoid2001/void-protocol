import { useCallback, useState, type DragEvent, type ChangeEvent } from "react";

interface FileDropzoneProps {
  onFile: (file: File) => void;
  label?: string;
}

export function FileDropzone({
  onFile,
  label = "Drop a file to prove it exists",
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition ${
        isDragging
          ? "border-void-accent bg-void-accent/5"
          : "border-void-border hover:border-[#888888]"
      }`}
    >
      <div className="mb-3 text-3xl opacity-30">
        {isDragging ? "+" : ""}
      </div>
      <p className="text-[#888888]">{label}</p>
      <p className="mt-2 text-sm text-[#888888]/60">
        or{" "}
        <label className="cursor-pointer text-void-accent underline">
          click to browse
          <input
            type="file"
            className="hidden"
            onChange={handleChange}
          />
        </label>
      </p>
    </div>
  );
}
