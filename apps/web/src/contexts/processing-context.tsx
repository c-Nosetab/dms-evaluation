'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export interface ProcessingJob {
  jobId: string;
  fileName: string;
  type: 'pdf-split' | 'image-convert' | 'ocr' | 'pdf-thumbnail';
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

interface ProcessingContextValue {
  jobs: ProcessingJob[];
  addJob: (job: ProcessingJob) => void;
  updateJob: (jobId: string, updates: Partial<ProcessingJob>) => void;
  removeJob: (jobId: string) => void;
  clearCompleted: () => void;
}

const ProcessingContext = createContext<ProcessingContextValue | null>(null);

export function ProcessingProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);

  // Track which jobs we're polling
  const pollingJobs = useRef<Set<string>>(new Set());

  const addJob = useCallback((job: ProcessingJob) => {
    setJobs((prev) => {
      // Don't add duplicate jobs
      if (prev.some((j) => j.jobId === job.jobId)) {
        return prev;
      }
      return [...prev, job];
    });
  }, []);

  const updateJob = useCallback((jobId: string, updates: Partial<ProcessingJob>) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.jobId === jobId ? { ...job, ...updates } : job
      )
    );
  }, []);

  const removeJob = useCallback((jobId: string) => {
    pollingJobs.current.delete(jobId);
    setJobs((prev) => prev.filter((job) => job.jobId !== jobId));
  }, []);

  const clearCompleted = useCallback(() => {
    setJobs((prev) => prev.filter((job) => job.status !== 'completed' && job.status !== 'failed'));
  }, []);

  // Poll for job status updates
  useEffect(() => {
    const activeJobs = jobs.filter(
      (job) => job.status === 'waiting' || job.status === 'active'
    );

    if (activeJobs.length === 0) return;

    const pollInterval = setInterval(async () => {
      for (const job of activeJobs) {
        // Skip if already polling this job
        if (pollingJobs.current.has(job.jobId)) continue;

        pollingJobs.current.add(job.jobId);

        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/processing/jobs/${job.jobId}`,
            { credentials: 'include' }
          );

          if (response.ok) {
            const data = await response.json();

            // Backend returns status directly as 'waiting', 'active', 'completed', 'failed'
            const status = data.status as ProcessingJob['status'];

            updateJob(job.jobId, {
              status,
              progress: data.progress || (status === 'completed' ? 100 : job.progress),
              error: data.error,
            });
          }
        } catch (error) {
          console.error('Failed to poll job status:', error);
        } finally {
          pollingJobs.current.delete(job.jobId);
        }
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [jobs, updateJob]);

  // Auto-remove completed jobs after 5 seconds
  useEffect(() => {
    const completedJobs = jobs.filter(
      (job) => job.status === 'completed' || job.status === 'failed'
    );

    if (completedJobs.length === 0) return;

    const timeouts = completedJobs.map((job) => {
      return setTimeout(() => {
        removeJob(job.jobId);
      }, 5000);
    });

    return () => timeouts.forEach(clearTimeout);
  }, [jobs, removeJob]);

  return (
    <ProcessingContext.Provider
      value={{ jobs, addJob, updateJob, removeJob, clearCompleted }}
    >
      {children}
    </ProcessingContext.Provider>
  );
}

export function useProcessing() {
  const context = useContext(ProcessingContext);
  if (!context) {
    throw new Error('useProcessing must be used within a ProcessingProvider');
  }
  return context;
}
