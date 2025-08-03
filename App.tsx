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

// オリジナル音源画面コンポーネント
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

  useEffect(() => {
    if (!sound) return;
    sound.setOnPlaybackStatusUpdate(status => {
      if (!status.isLoaded) return;
      setPosition(status.positionMillis);
      if (isLooping && aPoint !== null && bPoint !== null && status.positionMillis >= bPoint) {
        sound.setPositionAsync(aPoint);
      }
      if (status.didJustFinish) setIsPlaying(false);
    });
  }, [sound, aPoint, bPoint, isLooping]);

  const loadAndPlay = async () => {
    if (sound) await sound.unloadAsync();
    const { sound: newSound, status } = await Audio.Sound.createAsync(
      require('./assets/sample.mp3'),
      { shouldPlay: false, rate: speedRate, shouldCorrectPitch: true }
    );
    setSound(newSound);
    setDuration(status.durationMillis || 1);
    await newSound.playAsync();
    setIsPlaying(true);
  };

  const stop = async () => {
    if (sound) {
      await sound.stopAsync();
      setIsPlaying(false);
    }
  };

  const seek = (offset: number) => {
    if (!sound) return;
    const newPos = Math.max(0, Math.min(duration, position + offset));
    sound.setPositionAsync(newPos);
  };

  const changeRate = async (rate: number) => {
    if (sound) await sound.setRateAsync(rate, true);
    setSpeedRate(rate);
  };

  const toggleAPoint = () => setAPoint(prev => (prev === null ? position : null));
  const toggleBPoint = () => setBPoint(prev => (prev === null ? position : null));
  const toggleLoop = () => setIsLooping(prev => !prev);

  const onSliderLayout = (e: LayoutChangeEvent) => setSliderWidth(e.nativeEvent.layout.width);

  const saveSectionAndNavigate = async () => {
    if (aPoint === null || bPoint === null) return;
    if (sound) await sound.stopAsync();
    const newSection: Section = { a: aPoint, b: bPoint, memo: '' };
    const updated = [...sections, newSection];
    setSections(updated);
    navigation.navigate('Section', { sectionIndex: updated.length - 1 });
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
        {sliderWidth > 0 && aPoint !== null && <View style={[styles.marker, { left: (aPoint / duration) * sliderWidth }]} />}
        {sliderWidth > 0 && bPoint !== null && <View style={[styles.marker, { left: (bPoint / duration) * sliderWidth }]} />}
      </View>
      <Text style={styles.timeText}>
        {Math.floor(position/1000)}:{('0'+Math.floor((position%60000)/1000)).slice(-2)} / {Math.floor(duration/1000)}:{('0'+Math.floor((duration%60000)/1000)).slice(-2)}
      </Text>
      <View style={styles.row}>
        <Button title={aPoint===null?'A点':'A点解除'} onPress={toggleAPoint} />
        <Button title={bPoint===null?'B点':'B点解除'} onPress={toggleBPoint} />
        <Button title={isLooping?'ループ解除':'A-Bリピート'} onPress={toggleLoop} disabled={aPoint===null||bPoint===null} />
      </View>
      <View style={styles.row}>
        {[0.4,0.6,0.8,1.0].map(r => (<Button key={r} title={`${r}x`} onPress={() => changeRate(r)} disabled={speedRate===r}/>))}
      </View>
      <View style={{ marginTop:16 }}>
        <Button title="セクション保存" onPress={saveSectionAndNavigate} disabled={aPoint===null||bPoint===null} />
      {/* セクション一覧 */}
      {sections.length > 0 && (
        <View style={{ marginTop: 16 }}>
          {sections.map((sec: Section, idx: number) => (
            <View key={idx} style={{ marginVertical: 4 }}>
              <Button
                title={`セクション ${idx + 1}`}
                onPress={() => navigation.navigate('Section', { sectionIndex: idx })}
              />
            </View>
          ))}
        </View>
      )}
      </View>
    </ScrollView>
  );
}

// セクション画面: 再生/録音/メモ
function SectionScreen({ navigation, route, sections, setSections }: any) {
  const index = route.params.sectionIndex as number;
  const section = sections[index];

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(section.b - section.a);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedRate, setSpeedRate] = useState(1.0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordUri, setRecordUri] = useState<string | null>(section.recordingUri || null);
  const [memo, setMemo] = useState(section.memo);
  const [isMemoChanged, setIsMemoChanged] = useState(false);

  useEffect(() => {
    (async () => {
      if (sound) await sound.unloadAsync();
      const { sound: newSound } = await Audio.Sound.createAsync(
        require('./assets/sample.mp3'),
        { shouldPlay: false, rate: speedRate, shouldCorrectPitch: true }
      );
      setSound(newSound);
      newSound.setOnPlaybackStatusUpdate(status => {
        if (!status.isLoaded) return;
        setPosition(status.positionMillis);
        // B点で再生停止
        if (status.positionMillis >= section.b) {
          newSound.stopAsync();
          setIsPlaying(false);
          return;
        }
        if (status.didJustFinish) setIsPlaying(false);
      });
    })();
  }, [index, speedRate]);

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
  const seekSection = (offset: number) => {
    if (!sound) return;
    const newPos = Math.max(section.a, Math.min(section.b, position + offset));
    sound.setPositionAsync(newPos);
  };

  const startRecording = async () => {
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    setRecording(recording);
  };
  const stopRecording = async () => {
    if (!recording) return;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecordUri(uri);
    setRecording(null);
  };
  const playRecording = async () => {
    if (!recordUri) return;
    const { sound: recSound } = await Audio.Sound.createAsync({ uri: recordUri });
    await recSound.playAsync();
  };
  const saveRecording = () => {
    const updated = [...sections];
    updated[index].recordingUri = recordUri || '';
    setSections(updated);
  };

  useEffect(() => {
    setIsMemoChanged(memo.trim() !== section.memo.trim());
  }, [memo, section.memo]);
  const saveMemo = () => {
    const updated = [...sections];
    updated[index].memo = memo;
    setSections(updated);
    setIsMemoChanged(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>📋 セクション {index + 1}</Text>
      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={section.a}
          maximumValue={section.b}
          value={position}
          onSlidingComplete={val => sound?.setPositionAsync(val)}
        />
      </View>
      <Text style={styles.timeText}>
        {Math.floor(position/1000)}:{('0'+Math.floor((position%60000)/1000)).slice(-2)} ～ {Math.floor(section.b/1000)}:{('0'+Math.floor((section.b%60000)/1000)).slice(-2)}
      </Text>
      <View style={styles.row}>
        <Button title="10秒－" onPress={() => seekSection(-10000)} />
        <Button title={isPlaying ? '停止' : '再生'} onPress={isPlaying ? stopSection : playSection} />
        <Button title="10秒＋" onPress={() => seekSection(10000)} />
      </View>
      <Text style={styles.subheading}>再生速度</Text>
      <View style={styles.row}>
        {[0.4,0.6,0.8,1.0].map(r => (
          <Button key={r} title={`${r}x`} onPress={() => { setSpeedRate(r); sound?.setRateAsync(r, true); }} disabled={speedRate===r} />
        ))}
      </View>
      <Text style={styles.subheading}>録音</Text>
      <View style={styles.row}>
        <Button title="録音" onPress={startRecording} disabled={!!recording} />
        <Button title="停止" onPress={stopRecording} disabled={!recording} />
        <Button title="再生録音" onPress={playRecording} disabled={!recordUri} />
      </View>
      <Button title="録音を保存" onPress={saveRecording} disabled={!recordUri} />
      <Text style={styles.subheading}>メモ</Text>
      <TextInput
        style={styles.input}
        value={memo}
        onChangeText={setMemo}
        placeholder="メモを入力"
        multiline
      />
      <View style={{ marginVertical: 8 }}>
        <Button title="保存" onPress={saveMemo} disabled={!isMemoChanged} />
      </View>
      <Button title="戻る" onPress={() => navigation.goBack()} />
    </ScrollView>
  );
}

// Appコン포ーネント
export default function App() {
  const [sections, setSections] = useState<Section[]>([]);
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Original">
        <Stack.Screen name="Original" options={{ title: 'オリジナル音源' }}>
          {props => (
            <OriginalScreen
              {...props}
              sections={sections}
              setSections={setSections}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Section" options={{ title: 'セクション' }}>
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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f0f0f0' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  sliderContainer: { width: '100%', height: 40, marginVertical: 8 },
  slider: { width: '100%', height: 40 },
  marker: { position: 'absolute', top: 0, width: 2, height: 40, backgroundColor: 'red' },
  timeText: { textAlign: 'center', marginBottom: 8 },
  subheading: { fontSize: 16, fontWeight: 'bold', marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 4, padding: 8, backgroundColor: '#fff', minHeight: 80 },
});
