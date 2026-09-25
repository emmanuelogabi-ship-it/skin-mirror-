import { decode } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from './supabase';
import type { ScanWithFindings } from './types';

export const MAX_PHOTOS = 5;
const TARGET_WIDTH = 1280; // plenty of detail for Claude, small enough to upload fast

/**
 * Resize and re-encode a photo as JPEG. Re-encoding also strips EXIF metadata
 * (GPS location, device details) before anything leaves the phone.
 */
export async function preparePhoto(uri: string, width: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  if (width > TARGET_WIDTH) ctx.resize({ width: TARGET_WIDTH, height: null });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
  if (!saved.base64) throw new Error('Could not process photo');
  return saved.base64;
}

export interface AnalysisResponse {
  scan_id: string;
  error?: string;
}

/** Create a scan, upload its photos to private storage, then ask the server to analyse it. */
export async function createAndAnalyzeScan(
  userId: string,
  photos: { uri: string; width: number }[],
  onStage?: (stage: 'preparing' | 'uploading' | 'analysing') => void,
): Promise<string> {
  if (photos.length < 1 || photos.length > MAX_PHOTOS) throw new Error('Add 1–5 photos');

  onStage?.('preparing');
  const encoded = await Promise.all(photos.map((p) => preparePhoto(p.uri, p.width)));

  onStage?.('uploading');
  const { data: scan, error: scanError } = await supabase
    .from('scans')
    .insert({ user_id: userId })
    .select('id')
    .single();
  if (scanError || !scan) throw new Error(scanError?.message ?? 'Could not start scan');

  const paths: string[] = [];
  for (let i = 0; i < encoded.length; i++) {
    const path = `${userId}/${scan.id}/${i}.jpg`;
    const { error } = await supabase.storage
      .from('skin-photos')
      .upload(path, decode(encoded[i]), { contentType: 'image/jpeg', upsert: false });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    paths.push(path);
  }
  const { error: pathError } = await supabase
    .from('scans')
    .update({ image_paths: paths })
    .eq('id', scan.id);
  if (pathError) throw new Error(pathError.message);

  onStage?.('analysing');
  const { data, error } = await supabase.functions.invoke<AnalysisResponse>('analyze-skin', {
    body: { scan_id: scan.id },
  });
  if (error) {
    // Surface the server's friendly message (e.g. daily limit) when there is one.
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? 'Analysis failed. Please try again.');
  }
  return data?.scan_id ?? scan.id;
}

export async function fetchScan(id: string): Promise<ScanWithFindings | null> {
  const { data } = await supabase
    .from('scans')
    .select('*, scan_findings(*)')
    .eq('id', id)
    .single();
  return (data as ScanWithFindings) ?? null;
}

export async function fetchScans(): Promise<ScanWithFindings[]> {
  const { data } = await supabase
    .from('scans')
    .select('*, scan_findings(*)')
    .order('created_at', { ascending: false })
    .limit(50);
  return (data as ScanWithFindings[]) ?? [];
}

export async function signedPhotoUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data } = await supabase.storage.from('skin-photos').createSignedUrls(paths, 60 * 10);
  return (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
}
