import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Screen, T } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { MAX_PHOTOS, createAndAnalyzeScan, type ManipulatableImage } from '@/lib/scan';

type CapturedImage = { source: ManipulatableImage; width: number };

const SHOTS = [
  { key: 'front', title: 'Look straight ahead', hint: 'Fit your face inside the oval' },
  { key: 'left', title: 'Turn to your right', hint: 'Show your left cheek' },
  { key: 'right', title: 'Turn to your left', hint: 'Show your right cheek' },
];

// One continuous recording that steps through all three poses, instead of three separate photos.
const SHOT_SECONDS = 2.5;
const CAPTURE_LEAD = 0.4; // grab each frame just before moving on, once the pose has settled
const TOTAL_SECONDS = SHOT_SECONDS * SHOTS.length;
const CAPTURE_TIMES = SHOTS.map((_, i) => Number(((i + 1) * SHOT_SECONDS - CAPTURE_LEAD).toFixed(2)));

const STAGE_COPY = {
  preparing: 'Preparing photos…',
  uploading: 'Uploading securely…',
  analysing: 'Analysing your skin… (about 20 seconds)',
};

/** Best-effort delete of the temporary recording — only the extracted frames are ever kept or uploaded. */
function cleanupVideo(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Not worth surfacing to the user.
  }
}

export default function Scan() {
  const c = useTheme();
  const { session } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const camera = useRef<CameraView>(null);
  const cancelledRef = useRef(false);
  const [mode, setMode] = useState<'tips' | 'camera' | 'processing' | 'review'>('tips');
  const [stageIndex, setStageIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [photos, setPhotos] = useState<CapturedImage[]>([]);
  const [stage, setStage] = useState<keyof typeof STAGE_COPY | null>(null);
  const [error, setError] = useState<string | null>(null);

  const player = useVideoPlayer(videoUri, (p) => {
    p.muted = true;
  });

  const shot = SHOTS[Math.min(stageIndex, SHOTS.length - 1)];

  // Once the recorded clip is ready, pull one frame per pose out of it.
  useEffect(() => {
    if (!videoUri) return;
    let settled = false;
    const sub = player.addListener('statusChange', async ({ status }) => {
      if (settled) return;
      if (status === 'readyToPlay') {
        settled = true;
        try {
          const thumbs = await player.generateThumbnailsAsync(CAPTURE_TIMES);
          setPhotos(thumbs.map((t) => ({ source: t, width: t.width })));
          setMode('review');
        } catch {
          setError('Could not process your video. Please try again.');
          setMode('tips');
        } finally {
          cleanupVideo(videoUri);
          setVideoUri(null);
        }
      } else if (status === 'error') {
        settled = true;
        setError('Could not process your video. Please try again.');
        setMode('tips');
        cleanupVideo(videoUri);
        setVideoUri(null);
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUri]);

  // Best-effort: don't leave a recording running if the screen is closed mid-scan.
  useEffect(() => () => {
    try {
      camera.current?.stopRecording();
    } catch {
      // Screen is unmounting anyway.
    }
  }, []);

  async function startCamera() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setError('Camera access is off. You can turn it on in Settings, or choose photos instead.');
        return;
      }
    }
    if (!micPermission?.granted) {
      // Video recording needs this even though we record muted — continue either way.
      await requestMicPermission();
    }
    setError(null);
    setMode('camera');
  }

  async function startRecording() {
    setStageIndex(0);
    setRecording(true);
    setError(null);
    cancelledRef.current = false;
    const timers = SHOTS.slice(1).map((_, i) =>
      setTimeout(() => setStageIndex(i + 1), (i + 1) * SHOT_SECONDS * 1000),
    );
    try {
      const result = await camera.current?.recordAsync({ maxDuration: TOTAL_SECONDS });
      timers.forEach(clearTimeout);
      setRecording(false);
      if (cancelledRef.current) return;
      if (result?.uri) {
        setMode('processing');
        setVideoUri(result.uri);
      } else {
        setError('Recording didn’t save. Please try again.');
        setMode('tips');
      }
    } catch {
      timers.forEach(clearTimeout);
      setRecording(false);
      if (!cancelledRef.current) {
        setError('Could not record video. Please try again.');
        setMode('tips');
      }
    }
  }

  function cancelRecording() {
    cancelledRef.current = true;
    camera.current?.stopRecording();
    setRecording(false);
    setMode('tips');
  }

  async function pickFromLibrary() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
      quality: 1,
      exif: false,
    });
    if (res.canceled) return;
    setPhotos(res.assets.slice(0, MAX_PHOTOS).map((a) => ({ source: a.uri, width: a.width })));
    setMode('review');
  }

  async function analyse() {
    if (!session) return;
    setError(null);
    try {
      const id = await createAndAnalyzeScan(session.user.id, photos, setStage);
      router.replace({ pathname: '/result/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setStage(null);
    }
  }

  if (mode === 'camera') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="front" mode="video" mute />
        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          <View style={styles.topBar}>
            <Pressable
              onPress={() => (recording ? cancelRecording() : setMode('tips'))}
              hitSlop={12}
              accessibilityRole="button">
              <T color="#fff">Cancel</T>
            </Pressable>
            {recording ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.recDot} />
                <T color="#fff" variant="small">{stageIndex + 1} of {SHOTS.length}</T>
              </View>
            ) : (
              <T color="#fff" variant="small">Ready</T>
            )}
          </View>
          <View style={styles.center} pointerEvents="none">
            <View style={styles.oval} />
            <T variant="heading" color="#fff" style={styles.shadow}>{shot.title}</T>
            <T variant="small" color="#fff" style={styles.shadow}>{shot.hint}</T>
          </View>
          <View style={styles.bottomBar}>
            <View style={{ width: 44 }} />
            <Pressable
              onPress={startRecording}
              disabled={recording}
              accessibilityRole="button"
              accessibilityLabel="Start recording"
              style={[styles.shutter, recording && { opacity: 0.5 }]}>
              <View style={styles.shutterInner} />
            </Pressable>
            <View style={{ width: 44 }} />
          </View>
          {!recording ? (
            <T variant="small" color="#fff" style={[styles.shadow, styles.recordHint]}>
              Tap to record — turn your head as prompted
            </T>
          ) : null}
        </SafeAreaView>
      </View>
    );
  }

  if (mode === 'processing') {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md }}>
          <ActivityIndicator size="large" color={c.accent} />
          <T variant="heading">Processing your scan…</T>
          <T variant="small" muted>Pulling three clear frames from your video.</T>
        </View>
      </Screen>
    );
  }

  if (mode === 'review') {
    return (
      <Screen
        footer={
          <>
            {stage ? <T variant="small" muted style={{ textAlign: 'center' }}>{STAGE_COPY[stage]}</T> : null}
            <Button title="Analyse my skin" onPress={analyse} loading={Boolean(stage)} disabled={!photos.length} />
            <Button
              title="Record again"
              variant="ghost"
              disabled={Boolean(stage)}
              onPress={() => { setPhotos([]); setMode('tips'); }}
            />
          </>
        }>
        <T variant="title">Your photos</T>
        <T muted>Check they’re sharp and well lit. Blurry or dark photos give less reliable results.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
          {photos.map((p, i) => (
            <Image
              key={i}
              source={typeof p.source === 'string' ? { uri: p.source } : p.source}
              style={[styles.thumb, { borderColor: c.border }]}
              accessibilityLabel={`Photo ${i + 1}`}
            />
          ))}
        </View>
        {error ? <Card tone="danger"><T variant="small" color={c.danger}>{error}</T></Card> : null}
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Open camera" onPress={startCamera} />
          <Button title="Choose from photos" variant="secondary" onPress={pickFromLibrary} />
          <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
        </>
      }>
      <T variant="title">For the best scan</T>
      {[
        ['Face a window', 'Soft daylight, no harsh lamps or backlight.'],
        ['Bare skin if you can', 'Remove make-up and turn off beauty filters.'],
        ['Hair back, glasses off', 'So we can see your forehead and under-eyes.'],
        ['Same spot each time', 'Consistent light makes your progress easy to compare.'],
      ].map(([title, body]) => (
        <View key={title} style={{ gap: 2 }}>
          <T variant="heading">{title}</T>
          <T variant="small" muted>{body}</T>
        </View>
      ))}
      {error ? <Card tone="warn"><T variant="small">{error}</T></Card> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  center: { alignItems: 'center', gap: Spacing.sm },
  oval: { width: 240, height: 320, borderRadius: 160, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', marginBottom: Spacing.md },
  shadow: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  recordHint: { textAlign: 'center', paddingBottom: Spacing.sm },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E23D28' },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E23D28' },
  thumb: { width: 104, height: 138, borderRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth },
});
