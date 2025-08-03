import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Button,
  ScrollView,
  TextInput,
  LayoutChangeEvent,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Section型定義
type Section = { a: number; b: number; memo: string; recordingUri?: string };
const Stack = createStackNavigator();

export default function App() {
  const [sections, setSections] = useState<Section[]>([]);

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Original">
        <Stack.Screen
          name="Original"
          options={{ title: 'オリジナル音源' }}
        >
          {props => (
            <OriginalScreen
              {...props}
              sections={sections}
              setSections={setSections}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Section"
          options={{ title: 'セクション' }}
        >
          {props => (
            <SectionScreen
              {...props}
              sections={sections}
              setSections={setSections}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// オリジナル音源画面
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
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });
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
    newSound.setOnPlaybackStatusUpdate(st => {
      if (!st.isLoaded) return;
      setPosition(st.positionMillis);
      if (isLooping && aPoint != null && bPoint != null && st.positionMillis >= bPoint) {
        newSound.setPositionAsync(aPoint);
      }
      if (st.didJustFinish) setIsPlaying(false);
    });
  };

  const stop = async () => {
    if (sound) {
      await sound.stopAsync();
      setIsPlaying(false);
    }
  };

  const seek = (offset: number) => {
    if (sound) {
      const newPos = Math.max(0, Math.min(duration, position + offset));
      sound.setPositionAsync(newPos);
    }
  };

  const changeRate = async (rate: number) => {
    if (sound) await sound.setRateAsync(rate, true);
    setSpeedRate(rate);
  };

  const toggleAPoint = () => {
    setAPoint(prev => (prev === null ? position : null));
  };
  const toggleBPoint = () => {
    setBPoint(prev => (prev === null ? position : null));
  };
  const toggleLoop = async () => {
    if (aPoint != null && bPoint != null) {
      const newLoop = !isLooping;
      setIsLooping(newLoop);
      if (newLoop && sound) {
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

  const saveSectionAndNavigate = () => {
    if (aPoint == null || bPoint == null) return;
    const newSection: Section = { a: aPoint, b: bPoint, memo: '' };
    const updated = [...sections, newSection];
    setSections(updated);
    const index = updated.length - 1;
    navigation.navigate('Section', { sectionIndex: index });
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
          <View
            style={[styles.markerLine, { left: (aPoint / duration) * sliderWidth }]} />
        )}
        {sliderWidth > 0 && bPoint != null && (
          <View
            style={[styles.markerLine, { left: (bPoint / duration) * sliderWidth }]} />
        )}
      </View>
      <Text style={styles.timeText}>
        {Math.floor(position / 1000)}:{('0' + Math.floor((position % 60000) / 1000)).slice(-2)} /{' '}
        {Math.floor(duration / 1000)}:{('0' + Math.floor((duration % 60000) / 1000)).slice(-2)}
      </Text>
      <View style={styles.row}>
        <Button
          title={aPoint == null ? 'A点' : 'A点解除'}
          onPress={toggleAPoint}
        />
        <Button
          title={bPoint == null ? 'B点' : 'B点解除'}
          onPress={toggleBPoint}
        />
        <Button
          title={isLooping ? 'ループ解除' : 'A-Bリピート'}
          onPress={toggleLoop}
          disabled={aPoint == null || bPoint == null}
        />
      </View>
      <View style={styles.row}>
        {[0.4, 0.6, 0.8, 1.0].map(r => (
          <Button
            key={r}
            title={`${r}x`}
            onPress={() => changeRate(r)}
            disabled={speedRate === r}
          />
        ))}
      </View>
      <View style={{ marginTop: 16 }}>
        <Button
          title="セクション保存"
          onPress={saveSectionAndNavigate}
          disabled={aPoint == null || bPoint == null}
        />
      </View>
      <View style={[styles.row, { flexWrap: 'wrap', marginTop: 8 }]}> 
        {sections.map((_, i) => (
          <View key={i} style={{ margin: 4 }}>
            <Button
              title={`セクション ${i + 1}`}
              onPress={() => navigation.navigate('Section', { sectionIndex: i })}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// セクション画面
function SectionScreen({ navigation, route, sections, setSections }: any) {
  const index = route.params.sectionIndex as number;
  const section = sections[index];

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedRate, setSpeedRate] = useState(1.0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [tempUri, setTempUri] = useState<string | null>(null);
  const [memo, setMemo] = useState(section.memo);

  useEffect(() => {
    (async () => {
      if (sound) await sound.unloadAsync();
      const { sound: newSound, status } = await Audio.Sound.createAsync(
        require('./assets/sample.mp3'),
        { shouldPlay: false, rate: speedRate, shouldCorrectPitch: true }
      );
      setSound(newSound);
      newSound.setOnPlaybackStatusUpdate(st => {
        if (!st.isLoaded) return;
        setPosition(st.positionMillis);
        if (st.positionMillis >= section.b) {
          newSound.setPositionAsync(section.a);
        }
        if (st.didJustFinish) setIsPlaying(false);
      });
    })();
  }, [index]);

  const playSection = async () => {
    if (!sound) return;
    await sound.setPositionAsync(section.a);
    await sound.playAsync();
    setIsPlaying(true);
  };
  const stopSection = async () => {
    if (!sound) return;
    await sound.stopAsync();
    setIsPlaying(false);
  };
  const seek = (offset: number) => {
    if (!sound) return;
    const newPos = Math.max(section.a, Math.min(section.b, position + offset));
    sound.setPositionAsync(newPos);
  };
  const changeRateSection = async (rate: number) => {
    if (sound) await sound.setRateAsync(rate, true);
    setSpeedRate(rate);
  };

  const startRec = async () => {
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    setRecording(recording);
  };
  const stopRec = async () => {
    if (!recording) return;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setTempUri(uri || null);
    setRecording(null);
  };
  const playRec = async () => {
    if (!tempUri) return;
    const { sound: recSound } = await Audio.Sound.createAsync({ uri: tempUri });
    await recSound.playAsync();
  };
  const saveAudio = () => {
    if (!tempUri) return;
    const updated = [...sections];
    updated[index].recordingUri = tempUri;
    setSections(updated);
  };

  const saveMemo = () => {
    const updated = [...sections];
    updated[index].memo = memo;
    setSections(updated);
    navigation.goBack();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>📋 セクション {index + 1}</Text>
      <Slider
        style={styles.slider}
        minimumValue={section.a}
        maximumValue={section.b}
        value={position}
        onSlidingComplete={val => sound?.setPositionAsync(val)}
      />
      <Text style={styles.timeText}>
        {Math.floor(position / 1000)}:{('0' + Math.floor((position % 60000) / 1000)).slice(-2)}
        {' '}~ {Math.floor(section.b / 1000)}:{('0' + Math.floor((section.b % 60000) / 1000)).slice(-2)}
      </Text>
      <View style={styles.row}>
        <Button title="10秒－" onPress={() => seek(-10000)} />
        <Button title={isPlaying ? '停止' : '再生'} onPress={isPlaying ? stopSection : playSection} />
        <Button title="10秒＋" onPress={() => seek(10000)} />
      </View>
      <Text style={styles.subheading}>再生速度</Text>
      <View style={styles.row}>
        {[0.4, 0.6, 0.8, 1.0].map(r => (
          <Button key={r} title={`${r}`} onPress={() => changeRateSection(r)} disabled={speedRate === r} />
        ))}
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Button title="録音" onPress={startRec} disabled={!!recording} />
        <Button title="停止" onPress={stopRec} disabled={!recording} />
        <Button title="再生" onPress={playRec} disabled={!tempUri} />
      </View>
      <Button
        title={`この音声をセクション${index + 1}に保存`}
        onPress={saveAudio}
        disabled={!tempUri}
      />
      <Text style={{ marginTop: 16 }}>メモ:</Text>
      <TextInput
        style={styles.input}
        value={memo}
        onChangeText={setMemo}
        placeholder="このセクションのメモ"
        multiline
      />
      <View style={{ marginVertical: 8 }}>
        <Button title="保存" onPress={saveMemo} />
      </View>
      <Button title="戻る" onPress={() => navigation.goBack()} />
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
  subheading: { fontSize: 16, fontWeight: 'bold', marginTop: 12, marginBottom: 4 },
  divider: { height: 1, backgroundColor: '#ccc', marginVertical: 12 },
  input: { borderWidth: 1, borderRadius: 4, padding: 8, backgroundColor: '#fff', minHeight: 80 },
});
