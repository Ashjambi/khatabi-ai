
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
     * معالجة الملفات المرفوعة - تم إلغاء فلترة الامتدادات تماماً لضمان "رؤية" كافة الملفات
     */
    static async processUploadedFiles(files: FileList | File[]): Promise<Letter[]> {
        const letters: Letter[] = [];
        const fileArray = Array.from(files);

        for (const file of fileArray) {
            try {
                // قراءة محتوى الملف كنص أياً كان امتداده
                const text = await file.text();
                let parsedData;
                
                try {
                    parsedData = JSON.parse(text);
                } catch (e) {
                    // إذا لم يكن الملف بتنسيق JSON صالح، نتجاهله ببساطة وننتقل للتالي
                    continue; 
                }
                
                const normalize = (l: any): Letter | null => {
                    // التحقق من وجود الحقول الأساسية التي تجعل الملف "خطاباً" صالحاً للنظام
                    if (!l || typeof l !== 'object' || (!l.subject && !l.body)) return null;
                    
                    return {
                        ...l,
                        // توليد ID إذا كان مفقوداً لضمان عدم ضياع البيانات
                        id: l.id || `imported_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                        subject: l.subject || 'بدون عنوان',
                        date: l.date || new Date().toLocaleDateString('ar-SA-u-nu-latn'),
                        approvalHistory: Array.isArray(l.approvalHistory) ? l.approvalHistory : []
                    } as Letter;
                };

                if (Array.isArray(parsedData)) {
                    parsedData.forEach(item => {
                        const normalized = normalize(item);
                        if (normalized) letters.push(normalized);
                    });
                } else {
                    const normalized = normalize(parsedData);
                    if (normalized) letters.push(normalized);
                }
            } catch (e) {
                console.warn(`تعذر فحص الملف: ${file.name}`, e);
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
            if ((await (handle as any).queryPermission(options)) === 'granted') return true;
            if ((await (handle as any).requestPermission(options)) === 'granted') return true;
        } catch (err) {
            console.error("Permission verification failed", err);
        }
        return false;
    }

    /**
     * تحميل كافة الملفات من مجلد محلي - شامل لكل الملفات أياً كانت تسميتها
     */
    static async loadAllLetters(dirHandle: FileSystemDirectoryHandle): Promise<Letter[]> {
        const letters: Letter[] = [];
        
        async function scanDirectory(handle: FileSystemDirectoryHandle) {
            // @ts-ignore
            for await (const entry of handle.values()) {
                if (entry.kind === 'file') {
                    try {
                        const fileHandle = entry as FileSystemFileHandle;
                        const file = await fileHandle.getFile();
                        // نستخدم نفس منطق المعالجة المرن
                        const processed = await FileSystemService.processUploadedFiles([file]);
                        letters.push(...processed);
                    } catch (err) {
                        console.warn(`خطأ في قراءة ملف من المجلد ${entry.name}:`, err);
                    }
                } else if (entry.kind === 'directory') {
                    // استمرار البحث في المجلدات الفرعية
                    await scanDirectory(entry as FileSystemDirectoryHandle);
                }
            }
        }

        try {
            await scanDirectory(dirHandle);
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
