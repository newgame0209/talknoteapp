/**
 * MultiPageService - 複数ページ管理サービス
 * ノートの複数ページ機能を管理し、
 * ページの追加、削除、移動、分割を行う
 */

import { UniversalNote, PageOperation } from '../types/UniversalNote';
import { universalNoteService } from './UniversalNoteService';

// ===============================
// インターフェース定義
// ===============================

export interface MultiPageServiceConfig {
  enableAutoSplit: boolean;
  maxCharactersPerPage: number;
  splitBoundary: 'sentence' | 'paragraph' | 'character';
  preserveStructure: boolean;
  debugMode: boolean;
}

export interface PageCreateData {
  pageNumber?: number;
  canvasData?: any;
  pageMetadata?: any;
}

export interface PageSplitResult {
  originalPageId: string;
  newPages: Array<{
    pageId: string;
    pageNumber: number;
    canvasData: any;
    textContent: string;
  }>;
  totalPages: number;
}

export interface PageMoveResult {
  success: boolean;
  fromPageNumber: number;
  toPageNumber: number;
  affectedPages: string[];
}

// ===============================
// MultiPageService クラス
// ===============================

export class MultiPageService {
  private config: MultiPageServiceConfig;

  constructor(config: Partial<MultiPageServiceConfig> = {}) {
    this.config = {
      enableAutoSplit: true,
      maxCharactersPerPage: 2000,
      splitBoundary: 'paragraph',
      preserveStructure: true,
      debugMode: false,
      ...config
    };

    this.log('MultiPageService initialized', { config: this.config });
  }

  // ===============================
  // ページ作成・追加
  // ===============================

  /**
   * 新しいページを追加
   */
  async addPage(
    noteId: string,
    pageData?: PageCreateData
  ): Promise<{
    pageId: string;
    pageNumber: number;
    success: boolean;
  }> {
    try {
      const note = await universalNoteService.loadUniversalNote(noteId);
      if (!note) {
        throw new Error(`Note not found: ${noteId}`);
      }

      // 新しいページIDを生成
      const pageId = this.generatePageId();
      const pageNumber = pageData?.pageNumber || (note.pages?.length || 0) + 1;

      // ページ番号の調整（既存ページの番号をシフト）
      if (pageData?.pageNumber && pageData.pageNumber <= (note.pages?.length || 0)) {
        await this.shiftPageNumbers(note, pageData.pageNumber, 1);
      }

      // 新しいページデータを作成
      const newPage = {
        pageId,
        pageNumber,
        canvasData: pageData?.canvasData || this.getEmptyCanvasData(),
        lastModified: new Date().toISOString(),
        pageMetadata: pageData?.pageMetadata || {}
      };

      // ノートに新しいページを追加
      const updatedNote: UniversalNote = {
        ...note,
        pages: [...(note.pages || []), newPage],
        currentPageIndex: (note.pages?.length || 0), // 新しいページのインデックス
        metadata: {
          ...note.metadata
        },
        lastModified: new Date().toISOString()
      };

      // ノートを保存
      await universalNoteService.saveUniversalNote(updatedNote);

      this.log('Page added successfully', { 
        noteId, 
        pageId, 
        pageNumber,
        totalPages: updatedNote.metadata.totalPages
      });

      return {
        pageId,
        pageNumber,
        success: true
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Failed to add page', { noteId, error: errorMessage });
      
      return {
        pageId: '',
        pageNumber: 0,
        success: false
      };
    }
  }

  // ===============================
  // ページ削除
  // ===============================

  /**
   * ページを削除
   */
  async deletePage(
    noteId: string,
    pageId: string
  ): Promise<{
    success: boolean;
    remainingPages: number;
  }> {
    try {
      const note = await universalNoteService.loadUniversalNote(noteId);
      if (!note || !note.pages) {
        throw new Error(`Note or pages not found: ${noteId}`);
      }

      // 最後のページは削除不可
      if (note.pages.length <= 1) {
        this.log('Cannot delete last page', { noteId, pageId });
        return { success: false, remainingPages: 1 };
      }

      // 削除対象ページを特定
      const pageIndex = note.pages.findIndex(p => p.pageId === pageId);
      if (pageIndex === -1) {
        throw new Error(`Page not found: ${pageId}`);
      }

      const deletedPageNumber = note.pages[pageIndex].pageNumber;

      // ページを削除
      const updatedPages = note.pages.filter(p => p.pageId !== pageId);

      // ページ番号を再調整
      const reorderedPages = updatedPages.map((page, index) => ({
        ...page,
        pageNumber: index + 1
      }));

      // 現在のページが削除された場合、前のページに移動
      let newCurrentPage = note.currentPage;
      if (note.currentPage.pageId === pageId) {
        const newPageIndex = Math.max(0, pageIndex - 1);
        newCurrentPage = {
          pageId: reorderedPages[newPageIndex].pageId,
          pageNumber: reorderedPages[newPageIndex].pageNumber
        };
      }

      // ノートを更新
      const updatedNote: UniversalNote = {
        ...note,
        pages: reorderedPages,
        currentPage: newCurrentPage,
        metadata: {
          ...note.metadata,
          totalPages: reorderedPages.length
        },
        lastModified: new Date().toISOString()
      };

      await universalNoteService.saveUniversalNote(updatedNote);

      this.log('Page deleted successfully', { 
        noteId, 
        pageId, 
        deletedPageNumber,
        remainingPages: reorderedPages.length
      });

      return {
        success: true,
        remainingPages: reorderedPages.length
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Failed to delete page', { noteId, pageId, error: errorMessage });
      
      return {
        success: false,
        remainingPages: 0
      };
    }
  }

  // ===============================
  // ページ移動・並び替え
  // ===============================

  /**
   * ページの順序を変更
   */
  async movePage(
    noteId: string,
    pageId: string,
    newPageNumber: number
  ): Promise<PageMoveResult> {
    try {
      const note = await universalNoteService.loadUniversalNote(noteId);
      if (!note || !note.pages) {
        throw new Error(`Note or pages not found: ${noteId}`);
      }

      const pageIndex = note.pages.findIndex(p => p.pageId === pageId);
      if (pageIndex === -1) {
        throw new Error(`Page not found: ${pageId}`);
      }

      const currentPageNumber = note.pages[pageIndex].pageNumber;
      
      // 範囲チェック
      if (newPageNumber < 1 || newPageNumber > note.pages.length) {
        throw new Error(`Invalid page number: ${newPageNumber}`);
      }

      // 同じ位置の場合は何もしない
      if (currentPageNumber === newPageNumber) {
        return {
          success: true,
          fromPageNumber: currentPageNumber,
          toPageNumber: newPageNumber,
          affectedPages: []
        };
      }

      // ページを移動
      const pages = [...note.pages];
      const [movedPage] = pages.splice(pageIndex, 1);
      pages.splice(newPageNumber - 1, 0, movedPage);

      // ページ番号を再調整
      const reorderedPages = pages.map((page, index) => ({
        ...page,
        pageNumber: index + 1
      }));

      // 現在のページ情報を更新
      const updatedCurrentPage = {
        pageId: movedPage.pageId,
        pageNumber: newPageNumber
      };

      const updatedNote: UniversalNote = {
        ...note,
        pages: reorderedPages,
        currentPage: updatedCurrentPage,
        lastModified: new Date().toISOString()
      };

      await universalNoteService.saveUniversalNote(updatedNote);

      const affectedPages = reorderedPages.map(p => p.pageId);

      this.log('Page moved successfully', { 
        noteId, 
        pageId, 
        fromPageNumber: currentPageNumber,
        toPageNumber: newPageNumber,
        affectedPages: affectedPages.length
      });

      return {
        success: true,
        fromPageNumber: currentPageNumber,
        toPageNumber: newPageNumber,
        affectedPages
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Failed to move page', { noteId, pageId, newPageNumber, error: errorMessage });
      
      return {
        success: false,
        fromPageNumber: 0,
        toPageNumber: 0,
        affectedPages: []
      };
    }
  }

  // ===============================
  // 自動ページ分割
  // ===============================

  /**
   * 大容量コンテンツを自動分割
   */
  async splitPageByContent(
    noteId: string,
    pageId: string,
    textContent: string
  ): Promise<PageSplitResult | null> {
    try {
      if (!this.config.enableAutoSplit) {
        this.log('Auto split disabled', { noteId, pageId });
        return null;
      }

      if (textContent.length <= this.config.maxCharactersPerPage) {
        this.log('Content within page limit', { 
          noteId, 
          pageId, 
          contentLength: textContent.length,
          limit: this.config.maxCharactersPerPage
        });
        return null;
      }

      // テキストを分割
      const splitTexts = this.splitTextByBoundary(textContent);
      
      if (splitTexts.length <= 1) {
        this.log('Content cannot be split further', { noteId, pageId });
        return null;
      }

      const note = await universalNoteService.loadUniversalNote(noteId);
      if (!note || !note.pages) {
        throw new Error(`Note or pages not found: ${noteId}`);
      }

      const originalPageIndex = note.pages.findIndex(p => p.pageId === pageId);
      if (originalPageIndex === -1) {
        throw new Error(`Page not found: ${pageId}`);
      }

      const originalPage = note.pages[originalPageIndex];

      // 新しいページを作成
      const newPages = splitTexts.map((text, index) => ({
        pageId: index === 0 ? pageId : this.generatePageId(),
        pageNumber: originalPage.pageNumber + index,
        canvasData: this.textToCanvasData(text),
        lastModified: new Date().toISOString(),
        pageMetadata: {
          ...originalPage.pageMetadata,
          isAutoSplit: true,
          originalPageId: pageId,
          splitIndex: index
        }
      }));

      // 既存ページを新しいページで置換
      const updatedPages = [
        ...note.pages.slice(0, originalPageIndex),
        ...newPages,
        ...note.pages.slice(originalPageIndex + 1)
      ];

      // ページ番号を再調整
      const reorderedPages = updatedPages.map((page, index) => ({
        ...page,
        pageNumber: index + 1
      }));

      const updatedNote: UniversalNote = {
        ...note,
        pages: reorderedPages,
        currentPage: {
          pageId: newPages[0].pageId,
          pageNumber: newPages[0].pageNumber
        },
        metadata: {
          ...note.metadata,
          totalPages: reorderedPages.length
        },
        lastModified: new Date().toISOString()
      };

      await universalNoteService.saveUniversalNote(updatedNote);

      this.log('Page split successfully', { 
        noteId, 
        originalPageId: pageId,
        newPagesCount: newPages.length,
        totalPages: reorderedPages.length
      });

      return {
        originalPageId: pageId,
        newPages: newPages.map(p => ({
          pageId: p.pageId,
          pageNumber: p.pageNumber,
          canvasData: p.canvasData,
          textContent: this.extractTextFromCanvasData(p.canvasData)
        })),
        totalPages: reorderedPages.length
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Failed to split page', { noteId, pageId, error: errorMessage });
      return null;
    }
  }

  // ===============================
  // ユーティリティ関数
  // ===============================

  /**
   * ページ番号をシフト
   */
  private async shiftPageNumbers(
    note: UniversalNote,
    fromPageNumber: number,
    shift: number
  ): Promise<void> {
    if (!note.pages) return;

    note.pages.forEach(page => {
      if (page.pageNumber >= fromPageNumber) {
        page.pageNumber += shift;
      }
    });
  }

  /**
   * テキストを境界で分割
   */
  private splitTextByBoundary(text: string): string[] {
    const maxLength = this.config.maxCharactersPerPage;
    
    switch (this.config.splitBoundary) {
      case 'paragraph':
        return this.splitByParagraph(text, maxLength);
      case 'sentence':
        return this.splitBySentence(text, maxLength);
      case 'character':
      default:
        return this.splitByCharacter(text, maxLength);
    }
  }

  /**
   * 段落で分割
   */
  private splitByParagraph(text: string, maxLength: number): string[] {
    const paragraphs = text.split(/\n\s*\n/);
    const result: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length <= maxLength) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk) {
          result.push(currentChunk);
        }
        
        if (paragraph.length > maxLength) {
          // 段落が長すぎる場合は文で分割
          result.push(...this.splitBySentence(paragraph, maxLength));
        } else {
          currentChunk = paragraph;
        }
      }
    }

    if (currentChunk) {
      result.push(currentChunk);
    }

    return result.length > 0 ? result : [text];
  }

  /**
   * 文で分割
   */
  private splitBySentence(text: string, maxLength: number): string[] {
    const sentences = text.split(/[。！？]/);
    const result: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const sentenceWithPunctuation = sentence + (sentence.length > 0 ? '。' : '');
      
      if (currentChunk.length + sentenceWithPunctuation.length <= maxLength) {
        currentChunk += sentenceWithPunctuation;
      } else {
        if (currentChunk) {
          result.push(currentChunk);
        }
        
        if (sentenceWithPunctuation.length > maxLength) {
          // 文が長すぎる場合は文字で分割
          result.push(...this.splitByCharacter(sentenceWithPunctuation, maxLength));
        } else {
          currentChunk = sentenceWithPunctuation;
        }
      }
    }

    if (currentChunk) {
      result.push(currentChunk);
    }

    return result.length > 0 ? result : [text];
  }

  /**
   * 文字数で分割
   */
  private splitByCharacter(text: string, maxLength: number): string[] {
    const result: string[] = [];
    
    for (let i = 0; i < text.length; i += maxLength) {
      result.push(text.slice(i, i + maxLength));
    }

    return result;
  }

  /**
   * 空のキャンバスデータを生成
   */
  private getEmptyCanvasData(): any {
    return {
      type: 'canvas',
      version: '1.0',
      content: '',
      drawingPaths: [],
      canvasSettings: {
        backgroundColor: '#ffffff',
        gridType: 'none',
        zoom: 1.0
      }
    };
  }

  /**
   * テキストをキャンバスデータに変換
   */
  private textToCanvasData(text: string): any {
    return {
      type: 'canvas',
      version: '1.0',
      content: text,
      drawingPaths: [],
      canvasSettings: {
        backgroundColor: '#ffffff',
        gridType: 'none',
        zoom: 1.0
      }
    };
  }

  /**
   * キャンバスデータからテキストを抽出
   */
  private extractTextFromCanvasData(canvasData: any): string {
    return canvasData?.content || '';
  }

  /**
   * ページIDを生成
   */
  private generatePageId(): string {
    return `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * ログ出力
   */
  private log(message: string, data?: any): void {
    if (this.config.debugMode) {
      console.log(`[MultiPageService] ${message}`, data || '');
    }
  }

  // ===============================
  // 設定・状態管理
  // ===============================

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<MultiPageServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log('Config updated', { config: this.config });
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): MultiPageServiceConfig {
    return { ...this.config };
  }
}

// ===============================
// エクスポート
// ===============================

export const multiPageService = new MultiPageService();
export default multiPageService; 