import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, ScrollView, LayoutChangeEvent } from 'react-native';
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

type Section = { a: number; b: number; memo: string; recordingUri?: string };
const Stack = createStackNavigator();

export default function App() {
  const [sections, setSections] = useState<Section[]>([]);
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Original">
        <Stack.Screen name="Original" options={{ title: 'オリジナル音源' }}>
          {props => <OriginalScreen {...props} sections={sections} setSections={setSections} />}
        </Stack.Screen>
        <Stack.Screen name="Section" options={{ title: 'セクション' }}>
          {props => <SectionScreen {...props} sections={sections} setSections={setSections} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function OriginalScreen({ navigation, sections, setSections }: any) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aPoint, setAPoint] = useState<number | null>(null);
  const [bPoint, setBPoint] = useState<number | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [speedRate, setSpeedRate] = useState(1.0);
  const [sliderWidth, setSliderWidth] = useState(0);

  useEffect(() => {
    Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, shouldDuckAndroid: true });
  }, []);

  const loadAndPlay = async () => {
    if (sound) await sound.unloadAsync();
    const { sound: newSound, status } = await Audio.Sound.createAsync(
      require('./assets/sample.mp3'),
      { shouldPlay: true, rate: speedRate, shouldCorrectPitch: true }
    );
    setSound(newSound);
    setIsPlaying(true);
    setDuration(status.durationMillis || 1);
  };

  // update playback status with latest loop points
  useEffect(() => {
    if (!sound) return;
    sound.setOnPlaybackStatusUpdate(st => {
      if (!st.isLoaded) return;
      setPosition(st.positionMillis);
      if (isLooping && aPoint != null && bPoint != null && st.positionMillis >= bPoint) {
        sound.setPositionAsync(aPoint);
      }
      if (st.didJustFinish) setIsPlaying(false);
    });
  }, [sound, aPoint, bPoint, isLooping]);

  const stop = async () => { if (sound) { await sound.stopAsync(); setIsPlaying(false); } };
  const seek = (offset: number) => { sound?.setPositionAsync(Math.max(0, Math.min(duration, position + offset))); };
  const changeRate = (rate: number) => { sound?.setRateAsync(rate, true); setSpeedRate(rate); };

  const toggleAPoint = () => { setAPoint(prev => (prev === null ? position : null)); };
  const toggleBPoint = () => { setBPoint(prev => (prev === null ? position : null)); };
  const toggleLoop = async () => {
    if (aPoint != null && bPoint != null) {
      const newLoop = !isLooping;
      setIsLooping(newLoop);
      if (newLoop && sound) {
        // A点からループ再生を開始
        await sound.setPositionAsync(aPoint);
        if (!isPlaying) {
          await sound.playAsync();
          setIsPlaying(true);
        }
      }
    }
  };

  const onSliderLayout = (e: LayoutChangeEvent) => {
    setSliderWidth(e.nativeEvent.layout.width);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🎧 オリジナル音源</Text>
      <View style={styles.row}>
        <Button title="再生" onPress={loadAndPlay} disabled={isPlaying} />
        <Button title="停止" onPress={stop} disabled={!isPlaying} />
      </View>
      <View style={styles.row}>
        <Button title="10秒－" onPress={() => seek(-10000)} />
        <Button title="1秒－" onPress={() => seek(-1000)} />
        <Button title="1秒＋" onPress={() => seek(1000)} />
        <Button title="10秒＋" onPress={() => seek(10000)} />
      </View>

      <View style={styles.sliderContainer} onLayout={onSliderLayout}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration}
          value={position}
          onSlidingComplete={val => sound?.setPositionAsync(val)}
        />
        {sliderWidth > 0 && aPoint != null && (
          <View style={[styles.markerLine, { left: (aPoint / duration) * sliderWidth }]} />
        )}
        {sliderWidth > 0 && bPoint != null && (
          <View style={[styles.markerLine, { left: (bPoint / duration) * sliderWidth }]} />
        )}
      </View>

      <Text style={styles.timeText}>
        {Math.floor(position / 1000)}:{('0' + Math.floor((position % 60000) / 1000)).slice(-2)} /{' '}
        {Math.floor(duration / 1000)}:{('0' + Math.floor((duration % 60000) / 1000)).slice(-2)}
      </Text>
      <View style={styles.row}>
        <Button title={aPoint == null ? 'A点' : 'A点解除'} onPress={toggleAPoint} />
        <Button title={bPoint == null ? 'B点' : 'B点解除'} onPress={toggleBPoint} />
        <Button title={isLooping ? 'ループ解除' : 'A-Bリピート'} onPress={toggleLoop} disabled={aPoint==null||bPoint==null} />
      </View>
      <View style={styles.row}>
        {[0.4, 0.6, 0.8, 1.0].map(r => (
          <Button key={r} title={`${r}x`} onPress={() => changeRate(r)} disabled={speedRate === r} />
        ))}
      </View>
      <View style={{ marginTop: 16 }}>
        <Button title="セクション" onPress={() => navigation.navigate('Section')} />
      </View>
    </ScrollView>
  );
}

function SectionScreen({ navigation, sections, setSections }: any) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [currentRec, setCurrentRec] = useState<number | null>(null);

  const startRec = async (i: number) => {
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    setRecording(recording);
    setCurrentRec(i);
  };
  const stopRec = async () => {
    if (!recording || currentRec === null) return;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    const upd = [...sections];
    if (uri) upd[currentRec].recordingUri = uri;
    setSections(upd);
    setRecording(null);
    setCurrentRec(null);
  };
  const playRec = async (uri: string) => {
    const { sound } = await Audio.Sound.createAsync({ uri });
    await sound.playAsync();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>📋 セクション</Text>
      {sections.map((s, i) => (
        <View key={i} style={styles.sectionItem}>
          <Text>区間 {i + 1}: {Math.floor(s.a / 1000)}s - {Math.floor(s.b / 1000)}s</Text>
          <View style={styles.row}>
            {!s.recordingUri && currentRec !== i && <Button title="録音" onPress={() => startRec(i)} />}
            {recording && currentRec === i && <Button title="録音停止" onPress={stopRec} />}
            {s.recordingUri && <Button title="録音再生" onPress={() => playRec(s.recordingUri!)} />}
          </View>
          <Text>メモ: {s.memo}</Text>
        </View>
      ))}
      <View style={{ marginTop: 16 }}>
        <Button title="戻る" onPress={() => navigation.goBack()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#f0f0f0' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  sliderContainer: { position: 'relative', width: '100%', height: 40, marginVertical: 8 },
  slider: { width: '100%', height: 40 },
  markerLine: { position: 'absolute', top: 0, width: 2, height: 40, backgroundColor: 'red' },
  timeText: { textAlign: 'center', marginBottom: 8 },
  sectionItem: { padding: 12, backgroundColor: '#fff', borderRadius: 4, marginVertical: 6 },
});
