import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Screen, T } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { MAX_PHOTOS, createAndAnalyzeScan } from '@/lib/scan';

type Photo = { uri: string; width: number };

const SHOTS = [
  { key: 'front', title: 'Look straight ahead', hint: 'Fit your face inside the oval' },
  { key: 'left', title: 'Turn to your right', hint: 'Show your left cheek' },
  { key: 'right', title: 'Turn to your left', hint: 'Show your right cheek' },
];

const STAGE_COPY = {
  preparing: 'Preparing photos…',
  uploading: 'Uploading securely…',
  analysing: 'Analysing your skin… (about 20 seconds)',
};

export default function Scan() {
  const c = useTheme();
  const { session } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [mode, setMode] = useState<'tips' | 'camera' | 'review'>('tips');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stage, setStage] = useState<keyof typeof STAGE_COPY | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shot = SHOTS[Math.min(photos.length, SHOTS.length - 1)];

  async function startCamera() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setError('Camera access is off. You can turn it on in Settings, or choose photos instead.');
        return;
      }
    }
    setError(null);
    setMode('camera');
  }

  async function capture() {
    const pic = await camera.current?.takePictureAsync({ quality: 0.9, shutterSound: false });
    if (!pic) return;
    const next = [...photos, { uri: pic.uri, width: pic.width }];
    setPhotos(next);
    if (next.length >= SHOTS.length) setMode('review');
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
    setPhotos(res.assets.slice(0, MAX_PHOTOS).map((a) => ({ uri: a.uri, width: a.width })));
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
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="front" mode="picture" />
        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
              <T color="#fff">Cancel</T>
            </Pressable>
            <T color="#fff" variant="small">{photos.length + 1} of {SHOTS.length}</T>
          </View>
          <View style={styles.center} pointerEvents="none">
            <View style={styles.oval} />
            <T variant="heading" color="#fff" style={styles.shadow}>{shot.title}</T>
            <T variant="small" color="#fff" style={styles.shadow}>{shot.hint}</T>
          </View>
          <View style={styles.bottomBar}>
            {photos.length > 0 ? (
              <Pressable onPress={() => setMode('review')} accessibilityRole="button">
                <T color="#fff">Done</T>
              </Pressable>
            ) : <View style={{ width: 44 }} />}
            <Pressable onPress={capture} accessibilityRole="button" accessibilityLabel="Take photo" style={styles.shutter}>
              <View style={styles.shutterInner} />
            </Pressable>
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>
      </View>
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
              title="Retake photos"
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
            <Image key={p.uri} source={{ uri: p.uri }} style={[styles.thumb, { borderColor: c.border }]} accessibilityLabel={`Photo ${i + 1}`} />
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
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  thumb: { width: 104, height: 138, borderRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth },
});
