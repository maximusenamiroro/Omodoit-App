import React, { useEffect, useRef } from 'react';
import { EASING } from '../theme';
import {
  View, Text, StyleSheet, Animated, StatusBar, Image,
} from 'react-native';


export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(20)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, damping: 12, stiffness: 100, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, easing: EASING.OUT, useNativeDriver: true }),
      ]),
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 400, easing: EASING.OUT, useNativeDriver: true }),
        Animated.spring(textSlide, { toValue: 0, damping: 14, stiffness: 100, useNativeDriver: true }),
      ]),
      Animated.timing(tagOpacity, { toValue: 1, duration: 300, easing: EASING.OUT, useNativeDriver: true }),
      Animated.delay(800),
    ]).start(() => {
      if (onFinish) onFinish();
    });
    // Mount-only by design: the splash animation runs once and then
    // hands off. Re-running it because onFinish changed identity would
    // replay the whole intro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={st.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1a" translucent />

      <Animated.View style={[st.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <Image
          source={require('../assets/images/logo.png')}
          style={st.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={[st.textWrap, { opacity: textOpacity, transform: [{ translateY: textSlide }] }]}>
        <Text style={st.appName}>omodoit</Text>
      </Animated.View>

      <Animated.View style={[st.tagWrap, { opacity: tagOpacity }]}>
        <Text style={st.tagline}>Find. Book. Track.</Text>
      </Animated.View>

      <View style={st.bottomRow}>
        <Text style={st.madeIn}>Made in Nigeria \U0001f1f3\U0001f1ec</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1a', alignItems: 'center', justifyContent: 'center' },

  logoWrap: { marginBottom: 20 },
  logo: { width: 120, height: 120 },

  textWrap: { marginBottom: 8 },
  appName: { fontSize: 32, fontWeight: '700', color: '#fff', letterSpacing: 1 },

  tagWrap: { marginBottom: 40 },
  tagline: { fontSize: 14, color: '#16a34a', fontWeight: '500', letterSpacing: 2 },

  bottomRow: { position: 'absolute', bottom: 50 },
  madeIn: { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
});
