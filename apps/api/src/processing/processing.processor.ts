import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import OpenAI from 'openai';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';
import Tesseract from 'tesseract.js';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (
  buffer: Buffer,
) => Promise<{ text: string; numpages: number }>;

// Configure pdfjs standard fonts path for proper text rendering
const standardFontsPath = path.join(
  process.cwd(),
  'node_modules/pdfjs-dist/standard_fonts/',
);
import {
  PROCESSING_QUEUE,
  ProcessingJobData,
  ProcessingJobResult,
  PdfSplitJobData,
  ImageConvertJobData,
  OcrJobData,
  PdfThumbnailJobData,
} from './processing.types';
import { StorageService } from '../storage/storage.service';
import { DATABASE_CONNECTION, files, folders } from '../database';
import type { Database } from '../database';
import { eq } from 'drizzle-orm';

@Processor(PROCESSING_QUEUE)
export class ProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(ProcessingProcessor.name);
  private readonly openai: OpenAI | null;

  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {
    super();

    // Initialize OpenAI if API key is configured
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
      this.logger.log('OpenAI client initialized for OCR');
    } else {
      this.openai = null;
      this.logger.warn(
        'OPENAI_API_KEY not configured - OCR will be unavailable',
      );
    }
  }

  async process(job: Job<ProcessingJobData>): Promise<ProcessingJobResult> {
    this.logger.log(`Processing job ${job.id} of type ${job.data.type}`);

    try {
      switch (job.data.type) {
        case 'pdf-split':
          return await this.processPdfSplit(job as Job<PdfSplitJobData>);
        case 'image-convert':
          return await this.processImageConvert(
            job as Job<ImageConvertJobData>,
          );
        case 'ocr':
          return await this.processOcr(job as Job<OcrJobData>);
        case 'pdf-thumbnail':
          return await this.processPdfThumbnail(
            job as Job<PdfThumbnailJobData>,
          );
        default:
          throw new Error(
            `Unknown job type: ${(job.data as { type: string }).type}`,
          );
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error}`);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ProcessingJobData>) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ProcessingJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }

  /**
   * Split a PDF into individual pages.
   * Creates a folder named after the prefix, then places each page inside.
   * Each page becomes a new file with the naming pattern: "Page 1.pdf", "Page 2.pdf", etc.
   */
  private async processPdfSplit(
    job: Job<PdfSplitJobData>,
  ): Promise<ProcessingJobResult> {
    const { userId, storageKey, outputNamePrefix, folderId } = job.data;

    // Download the original PDF
    await job.updateProgress(5);
    const pdfBuffer = await this.storageService.downloadFile(storageKey);

    // Load the PDF
    await job.updateProgress(10);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    this.logger.log(`Splitting PDF into ${pageCount} pages`);

    // Create a folder for the split pages
    const splitFolderId = crypto.randomUUID();
    await this.db.insert(folders).values({
      id: splitFolderId,
      userId,
      parentId: folderId || null,
      name: outputNamePrefix, // Use the prefix as folder name
      isStarred: false,
      isDeleted: false,
    });

    this.logger.log(`Created folder "${outputNamePrefix}" for split pages`);

    await job.updateProgress(15);

    const createdFileIds: string[] = [];

    // Create a new file for each page
    for (let i = 0; i < pageCount; i++) {
      const progress = 15 + Math.floor((i / pageCount) * 80);
      await job.updateProgress(progress);

      // Create a new PDF with just this page
      const newPdfDoc = await PDFDocument.create();
      const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
      newPdfDoc.addPage(copiedPage);

      const newPdfBytes = await newPdfDoc.save();
      const newPdfBuffer = Buffer.from(newPdfBytes);

      // Generate filename and storage key - now just "Page X.pdf"
      const pageNum = i + 1;
      const newFilename = `Page ${pageNum}.pdf`;
      const newStorageKey = this.storageService.generateStorageKey(
        userId,
        newFilename,
      );

      // Upload the new PDF
      await this.storageService.uploadFile(
        newStorageKey,
        newPdfBuffer,
        'application/pdf',
      );

      // Create database record - place in the split folder
      const newFileId = crypto.randomUUID();
      await this.db.insert(files).values({
        id: newFileId,
        userId,
        folderId: splitFolderId, // Place in the newly created folder
        name: newFilename,
        storageKey: newStorageKey,
        mimeType: 'application/pdf',
        sizeBytes: newPdfBuffer.length,
        isStarred: false,
        isDeleted: false,
      });

      createdFileIds.push(newFileId);
      this.logger.log(`Created split page ${pageNum}: ${newFilename}`);
    }

    await job.updateProgress(100);

    return {
      success: true,
      message: `Split PDF into ${pageCount} pages in folder "${outputNamePrefix}"`,
      outputFileIds: createdFileIds,
    };
  }

  /**
   * Convert an image to a different format (PNG, JPEG, or WebP).
   */
  private async processImageConvert(
    job: Job<ImageConvertJobData>,
  ): Promise<ProcessingJobResult> {
    const { userId, storageKey, filename, targetFormat, quality, folderId } =
      job.data;

    // Download the original image
    await job.updateProgress(20);
    const imageBuffer = await this.storageService.downloadFile(storageKey);

    // Convert the image
    await job.updateProgress(40);
    const sharpInstance = sharp(imageBuffer);

    let convertedBuffer: Buffer;
    let mimeType: string;
    const ext = targetFormat;

    switch (targetFormat) {
      case 'png':
        convertedBuffer = await sharpInstance.png().toBuffer();
        mimeType = 'image/png';
        break;
      case 'jpeg':
        convertedBuffer = await sharpInstance
          .jpeg({ quality: quality || 80 })
          .toBuffer();
        mimeType = 'image/jpeg';
        break;
      case 'webp':
        convertedBuffer = await sharpInstance
          .webp({ quality: quality || 80 })
          .toBuffer();
        mimeType = 'image/webp';
        break;
      default: {
        // TypeScript exhaustiveness check - targetFormat should never reach here
        const _exhaustiveCheck: never = targetFormat;
        throw new Error(
          `Unsupported target format: ${String(_exhaustiveCheck)}`,
        );
      }
    }

    await job.updateProgress(70);

    // Generate new filename (replace extension)
    const baseName = filename.replace(/\.[^.]+$/, '');
    const newFilename = `${baseName}.${ext}`;
    const newStorageKey = this.storageService.generateStorageKey(
      userId,
      newFilename,
    );

    // Upload the converted image
    await this.storageService.uploadFile(
      newStorageKey,
      convertedBuffer,
      mimeType,
    );

    await job.updateProgress(90);

    // Create database record
    const newFileId = crypto.randomUUID();
    await this.db.insert(files).values({
      id: newFileId,
      userId,
      folderId: folderId || null,
      name: newFilename,
      storageKey: newStorageKey,
      mimeType,
      sizeBytes: convertedBuffer.length,
      isStarred: false,
      isDeleted: false,
    });

    await job.updateProgress(100);

    this.logger.log(`Converted image to ${targetFormat}: ${newFilename}`);

    return {
      success: true,
      message: `Converted to ${targetFormat.toUpperCase()}`,
      outputFileIds: [newFileId],
    };
  }

  /**
   * Extract text from a PDF or image.
   * For PDFs: First tries direct text extraction (fast, free), falls back to OCR for scanned docs.
   * For images: Uses OpenAI Vision or Tesseract.js for OCR.
   * Saves results to the database for persistent access.
   */
  private async processOcr(job: Job<OcrJobData>): Promise<ProcessingJobResult> {
    const { fileId, storageKey, filename } = job.data;

    await job.updateProgress(5);
    const fileBuffer = await this.storageService.downloadFile(storageKey);

    await job.updateProgress(10);

    const isPdf = filename.toLowerCase().endsWith('.pdf');
    let fullText = '';
    let pageLabel = '1 image';
    let usedFallback = false;

    if (isPdf) {
      // For PDFs: Try direct text extraction first (much faster and more reliable)
      this.logger.log(
        `Attempting direct text extraction from PDF: ${filename}`,
      );

      try {
        await job.updateProgress(20);
        const pdfData = await pdfParse(fileBuffer);
        fullText = pdfData.text || '';
        pageLabel = `${pdfData.numpages} page(s)`;

        this.logger.log(
          `[pdf-parse] Extracted ${fullText.length} characters from ${pageLabel}`,
        );

        // Check if we got meaningful text (scanned PDFs return very little)
        const avgCharsPerPage = fullText.length / (pdfData.numpages || 1);
        if (avgCharsPerPage < 50) {
          this.logger.warn(
            `Low text density (${Math.round(avgCharsPerPage)} chars/page) - PDF may be scanned. Falling back to OCR.`,
          );
          fullText = ''; // Reset to trigger OCR fallback
        }
      } catch (error) {
        this.logger.warn(`Direct PDF text extraction failed: ${error}`);
        fullText = '';
      }

      await job.updateProgress(40);

      // If direct extraction failed or returned too little text, fall back to image-based OCR
      if (fullText.length < 100) {
        this.logger.log('Falling back to image-based OCR for scanned PDF...');
        usedFallback = true;

        try {
          // Convert PDF pages to images using pdfjs-dist
          const pdfData = new Uint8Array(fileBuffer);
          const cMapUrl = path.join(
            process.cwd(),
            'node_modules/pdfjs-dist/cmaps/',
          );
          const pdf = await pdfjs.getDocument({
            data: pdfData,
            cMapUrl,
            cMapPacked: true,
            standardFontDataUrl: standardFontsPath,
            useSystemFonts: true,
          }).promise;

          const maxPages = Math.min(pdf.numPages, 20);
          const extractedTexts: string[] = [];

          for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            const progress = 40 + Math.floor((pageNum / maxPages) * 50);
            await job.updateProgress(progress);

            const page = await pdf.getPage(pageNum);
            const scale = 2.0;
            const viewport = page.getViewport({ scale });

            const canvas = createCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d');
            context.fillStyle = 'white';
            context.fillRect(0, 0, viewport.width, viewport.height);

            await page.render({
              canvasContext: context as unknown as CanvasRenderingContext2D,
              viewport,
              background: 'white',
              canvas: canvas as unknown as HTMLCanvasElement,
            }).promise;

            const pngBuffer = canvas.toBuffer('image/png');

            // Use Tesseract.js for OCR on the rendered image
            try {
              const result = await Tesseract.recognize(pngBuffer, 'eng');
              extractedTexts.push(result.data.text);
              this.logger.log(
                `[Tesseract] Page ${pageNum}: ${result.data.text.length} chars`,
              );
            } catch (tessError) {
              this.logger.error(
                `Tesseract failed for page ${pageNum}: ${tessError}`,
              );
              extractedTexts.push(
                `[Error extracting text from page ${pageNum}]`,
              );
            }
          }

          fullText = extractedTexts.join('\n\n--- Page Break ---\n\n');
          pageLabel = `${maxPages} page(s)`;
        } catch (error) {
          this.logger.error(`Image-based OCR failed: ${error}`);
          return {
            success: false,
            message: `OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ocrText: undefined,
          };
        }
      }
    } else {
      // For images: Describe the image content (better UX than extracting text)
      this.logger.log(`Processing image: ${filename}`);

      await job.updateProgress(40);

      // Detect image type
      let mimeType = 'image/png';
      if (fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8) {
        mimeType = 'image/jpeg';
      } else if (
        fileBuffer[0] === 0x47 &&
        fileBuffer[1] === 0x49 &&
        fileBuffer[2] === 0x46
      ) {
        mimeType = 'image/gif';
      } else if (
        fileBuffer[0] === 0x52 &&
        fileBuffer[1] === 0x49 &&
        fileBuffer[2] === 0x46 &&
        fileBuffer[3] === 0x46
      ) {
        mimeType = 'image/webp';
      }

      // Try OpenAI Vision for intelligent image analysis
      if (this.openai) {
        try {
          const base64Image = fileBuffer.toString('base64');
          const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Describe what you see in this image. Focus on:
- The main subject and visual elements
- Colors, setting, and composition
- Notable details or context

Provide a clear, descriptive summary of the visual content in 2-4 sentences. If text is present, please transcribe the text.`,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${mimeType};base64,${base64Image}`,
                    },
                  },
                ],
              },
            ],
            max_tokens: 1024,
          });

          fullText = response.choices[0]?.message?.content || '';
          this.logger.log(
            `[OpenAI] Generated image description: ${fullText.length} characters`,
          );
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(`OpenAI Vision failed: ${errorMsg}`);
          fullText = '';
        }
      }

      // Fall back to Tesseract.js for text extraction if OpenAI is unavailable
      if (!fullText) {
        usedFallback = true;
        try {
          const result = await Tesseract.recognize(fileBuffer, 'eng');
          const tessText = result.data.text.trim();
          if (tessText.length > 20) {
            fullText = `[Text extracted from image]\n\n${tessText}`;
            this.logger.log(
              `[Tesseract] Extracted ${tessText.length} characters from image`,
            );
          } else {
            fullText =
              '[Image analysis unavailable - OpenAI API not configured. No significant text detected in image.]';
            this.logger.log(
              `[Tesseract] No significant text found in image (${tessText.length} chars)`,
            );
          }
        } catch (tessError) {
          this.logger.error(`Tesseract OCR failed: ${tessError}`);
          fullText =
            '[Image analysis failed - unable to process image content]';
        }
      }
    }

    await job.updateProgress(90);
    const mode = job.data.mode || 'extract';
    const isImage = !isPdf;

    this.logger.log(
      isImage
        ? `Image processing completed for ${filename}: ${fullText.length} characters`
        : `OCR completed for ${filename}: ${fullText.length} characters extracted from ${pageLabel}`,
    );

    // Generate summary if requested (requires OpenAI)
    let summary: string | undefined;
    const hasExtractableText = fullText.trim().length > 50;

    if (mode === 'summary' || mode === 'both') {
      if (this.openai) {
        if (isImage) {
          // For images: the fullText already contains the description from the first pass
          // Just use it directly as the summary - no need to re-process
          this.logger.log(`Using image description as summary for ${filename}`);
          summary = fullText;
        } else if (hasExtractableText) {
          // For PDFs with text, summarize the text content
          this.logger.log(`Generating text summary for ${filename}...`);

          try {
            const summaryResponse = await this.openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'system',
                  content:
                    'You are a document summarization assistant. Create concise, well-structured summaries that capture the key points, main ideas, and important details from the provided text.',
                },
                {
                  role: 'user',
                  content: `Please summarize the following document:\n\n${fullText}`,
                },
              ],
              max_tokens: 2048,
            });

            summary = summaryResponse.choices[0]?.message?.content || undefined;
            this.logger.log(
              `Generated text summary: ${summary?.length || 0} characters`,
            );
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            this.logger.error(`Summary generation failed: ${errorMsg}`);

            if (errorMsg.includes('429') || errorMsg.includes('quota')) {
              summary = '[Summary unavailable - OpenAI quota exceeded]';
            } else {
              summary = '[Error generating summary]';
            }
          }
        } else {
          // PDF with no extractable text
          summary = '[No text content found in this document]';
        }
      } else {
        // No OpenAI available
        summary = usedFallback
          ? '[Summary unavailable - text extracted using Tesseract.js (local OCR). AI summarization requires OpenAI API.]'
          : '[Summary unavailable - OpenAI API not configured]';
        this.logger.warn('Skipping summary generation - OpenAI not available');
      }
    }

    await job.updateProgress(95);

    // Save OCR results to the database for persistent access
    const updateData: {
      ocrText?: string;
      ocrSummary?: string;
      ocrProcessedAt: Date;
      updatedAt: Date;
    } = {
      ocrProcessedAt: new Date(),
      updatedAt: new Date(),
    };

    // Include text if mode is 'extract' or 'both'
    if (mode === 'extract' || mode === 'both') {
      updateData.ocrText = fullText;
    }

    // Include summary if mode is 'summary' or 'both'
    if (mode === 'summary' || mode === 'both') {
      updateData.ocrSummary = summary;
    }

    await this.db.update(files).set(updateData).where(eq(files.id, fileId));

    this.logger.log(`Saved OCR results to database for file ${fileId}`);

    await job.updateProgress(100);

    // Build result based on mode and file type
    const extractionMethod = usedFallback
      ? ' (using Tesseract.js)'
      : isPdf
        ? ' (direct text extraction)'
        : ' (AI vision analysis)';

    let resultMessage: string;
    if (isImage) {
      // Image-specific messages
      resultMessage =
        mode === 'summary'
          ? `Generated summary for image${extractionMethod}`
          : `Analyzed image content${extractionMethod}`;
    } else {
      // PDF messages
      resultMessage =
        mode === 'summary'
          ? `Generated summary from ${pageLabel}${extractionMethod}`
          : mode === 'both'
            ? `Extracted text and generated summary from ${pageLabel}${extractionMethod}`
            : `Extracted ${fullText.length} characters from ${pageLabel}${extractionMethod}`;
    }

    const result: ProcessingJobResult = {
      success: true,
      message: resultMessage,
    };

    // Include text if mode is 'extract' or 'both'
    if (mode === 'extract' || mode === 'both') {
      result.ocrText = fullText;
    }

    // Include summary if mode is 'summary' or 'both'
    if (mode === 'summary' || mode === 'both') {
      result.ocrSummary = summary;
    }

    return result;
  }

  /**
   * Generate a thumbnail from the first page of a PDF.
   */
  private async processPdfThumbnail(
    job: Job<PdfThumbnailJobData>,
  ): Promise<ProcessingJobResult> {
    const { fileId, userId, storageKey } = job.data;

    await job.updateProgress(10);

    // Download the PDF
    const pdfBuffer = await this.storageService.downloadFile(storageKey);

    await job.updateProgress(30);

    // Load the PDF and get the first page
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    if (pageCount === 0) {
      return {
        success: false,
        message: 'PDF has no pages',
      };
    }

    await job.updateProgress(50);

    // Create a single-page PDF with just the first page
    const thumbnailPdf = await PDFDocument.create();
    const [copiedPage] = await thumbnailPdf.copyPages(pdfDoc, [0]);
    thumbnailPdf.addPage(copiedPage);
    const thumbnailPdfBytes = await thumbnailPdf.save();

    await job.updateProgress(70);

    // Note: pdf-lib cannot directly convert to image.
    // We need to use pdf2pic or a similar library for actual rendering.
    // For now, we'll store the first-page PDF as a "thumbnail" and
    // the frontend can render it using PDF.js or similar.
    //
    // Alternative: Use canvas/pdfjs-dist server-side to render to PNG
    // For production, consider using pdf2pic with GraphicsMagick/ImageMagick

    const thumbnailKey = `thumbnails/${userId}/${fileId}.pdf`;

    await this.storageService.uploadFile(
      thumbnailKey,
      Buffer.from(thumbnailPdfBytes),
      'application/pdf',
    );

    await job.updateProgress(90);

    // Update the file record with the thumbnail key
    // Note: You may want to add a 'thumbnailKey' column to the files table
    // For now, we'll just return the key

    await job.updateProgress(100);

    this.logger.log(`Generated PDF thumbnail for file ${fileId}`);

    return {
      success: true,
      message: 'PDF thumbnail generated',
      thumbnailKey,
    };
  }
}
