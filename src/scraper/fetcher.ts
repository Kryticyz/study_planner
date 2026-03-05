/**
 * HTTP fetcher for ANU Programs & Courses pages.
 * Handles caching, rate limiting, and retry logic.
 */

import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://programsandcourses.anu.edu.au';

export interface FetcherOptions {
  cacheDir?: string;
  useCache?: boolean;
  minDelay?: number;
  maxDelay?: number;
  maxRetries?: number;
  year?: number;
}

export class ANUFetcher {
  private cacheDir: string;
  private useCache: boolean;
  private minDelay: number;
  private maxDelay: number;
  private maxRetries: number;
  private year: number;
  private lastRequestTime: number = 0;
  private consecutiveFailures: number = 0;

  constructor(options: FetcherOptions = {}) {
    this.cacheDir = options.cacheDir ?? './cache';
    this.useCache = options.useCache ?? true;
    this.minDelay = options.minDelay ?? 1000;
    this.maxDelay = options.maxDelay ?? 15000;
    this.maxRetries = options.maxRetries ?? 3;
    this.year = options.year ?? 2026;

    if (this.useCache) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private getCachePath(pageType: string, code: string): string {
    const dir = path.join(this.cacheDir, String(this.year), pageType);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${code}.html`);
  }

  private getCached(pageType: string, code: string): string | null {
    if (!this.useCache) return null;
    const cachePath = this.getCachePath(pageType, code);
    if (fs.existsSync(cachePath)) {
      return fs.readFileSync(cachePath, 'utf-8');
    }
    return null;
  }

  private setCache(pageType: string, code: string, html: string): void {
    if (!this.useCache) return;
    const cachePath = this.getCachePath(pageType, code);
    fs.writeFileSync(cachePath, html, 'utf-8');
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const delay = Math.min(
      this.minDelay * Math.pow(1.5, this.consecutiveFailures),
      this.maxDelay
    );
    if (elapsed < delay) {
      await new Promise(resolve => setTimeout(resolve, delay - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  async fetchHTML(url: string): Promise<string> {
    await this.rateLimit();

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'ANU-StudyPlanner-Scraper/1.0',
            'Accept': 'text/html',
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        this.consecutiveFailures = 0;
        return await response.text();
      } catch (error) {
        this.consecutiveFailures++;
        if (attempt === this.maxRetries - 1) throw error;
        const backoff = this.minDelay * Math.pow(2, attempt + 1);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }

    throw new Error(`Failed to fetch ${url} after ${this.maxRetries} attempts`);
  }

  async fetchCourse(code: string): Promise<string> {
    const cached = this.getCached('course', code);
    if (cached) return cached;

    const url = `${BASE_URL}/${this.year}/course/${code}`;
    const html = await this.fetchHTML(url);
    this.setCache('course', code, html);
    return html;
  }

  async fetchProgram(code: string): Promise<string> {
    const cached = this.getCached('program', code);
    if (cached) return cached;

    const url = `${BASE_URL}/${this.year}/program/${code}`;
    const html = await this.fetchHTML(url);
    this.setCache('program', code, html);
    return html;
  }

  async fetchMajor(code: string): Promise<string> {
    const cached = this.getCached('major', code);
    if (cached) return cached;

    const url = `${BASE_URL}/${this.year}/major/${code}`;
    const html = await this.fetchHTML(url);
    this.setCache('major', code, html);
    return html;
  }
}
