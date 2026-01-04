
import { Letter } from '../types';

declare global {
    interface Window {
        showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
    }
}

export class FileSystemService {
    
    static getFileName(letter: Letter): string {
        const safeSubject = letter.subject.replace(/[^a-z0-9\u0600-\u06FF\s-_]/gi, '').substring(0, 50).trim();
        const dateStr = letter.date ? letter.date.replace(/[\/\-]/g, '') : 'nodate';
        return `Khatabi_${dateStr}_${safeSubject}.json`;
    }

    static downloadLetterAsJson(letter: Letter) {
        const dataStr = JSON.stringify(letter, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = this.getFileName(letter);
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }

    static exportAllLetters(letters: Letter[]) {
        const dataStr = JSON.stringify(letters, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Khatabi_Archive_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    /**
     * معالجة الملفات المرفوعة المجلد
     * تم التحديث ليدعم الملفات التي تحتوي على مصفوفة خطابات (أرشيف) أو خطاب واحد
     */
    static async processUploadedFiles(files: FileList): Promise<Letter[]> {
        const letters: Letter[] = [];
        // جعل البحث عن الامتداد غير حساس لحالة الأحرف .json أو .JSON
        const fileArray = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.json'));

        for (const file of fileArray) {
            try {
                const text = await file.text();
                const parsedData = JSON.parse(text);
                
                // إذا كان الملف عبارة عن مصفوفة (أرشيف كامل)
                if (Array.isArray(parsedData)) {
                    parsedData.forEach(l => {
                        if (l.id && l.subject) letters.push(l);
                    });
                } 
                // إذا كان الملف خطاب واحد فقط
                else if (parsedData && parsedData.subject) {
                    letters.push(parsedData);
                }
            } catch (e) {
                console.warn(`تعذر قراءة أو تحليل الملف: ${file.name}`, e);
            }
        }
        return letters;
    }

    static isSupported(): boolean {
        return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
    }

    static canShowPicker(): boolean {
        try {
            return window.self === window.top;
        } catch (e) {
            return false;
        }
    }

    static async pickDirectory(): Promise<FileSystemDirectoryHandle> {
        return await window.showDirectoryPicker();
    }

    static async verifyPermission(handle: FileSystemDirectoryHandle, readWrite: boolean): Promise<boolean> {
        const options: any = {};
        if (readWrite) options.mode = 'readwrite';
        try {
            // @FIX: Cast handle to any to satisfy TS compiler for experimental File System Access API methods
            if ((await (handle as any).queryPermission(options)) === 'granted') return true;
            // @FIX: Cast handle to any
            if ((await (handle as any).requestPermission(options)) === 'granted') return true;
        } catch (err) {
            console.error("Permission verification failed", err);
        }
        return false;
    }

    static async loadAllLetters(dirHandle: FileSystemDirectoryHandle): Promise<Letter[]> {
        const letters: Letter[] = [];
        try {
            // @ts-ignore
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.json')) {
                    try {
                        const fileHandle = entry as FileSystemFileHandle;
                        const file = await fileHandle.getFile();
                        const text = await file.text();
                        const parsedData = JSON.parse(text);
                        if (Array.isArray(parsedData)) {
                            letters.push(...parsedData.filter(l => l.id && l.subject));
                        } else if (parsedData.id && parsedData.subject) {
                            letters.push(parsedData);
                        }
                    } catch (err) {
                        console.warn(`Skipping invalid file ${entry.name}`, err);
                    }
                }
            }
        } catch (error) {
            console.error("Error loading letters from directory:", error);
            throw error;
        }
        return letters;
    }

    static async saveLetter(dirHandle: FileSystemDirectoryHandle, letter: Letter): Promise<void> {
        try {
            const fileName = this.getFileName(letter);
            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(letter, null, 2));
            await writable.close();
        } catch (error) {
            console.error(`Failed to save letter ${letter.id}:`, error);
            throw error;
        }
    }
}
