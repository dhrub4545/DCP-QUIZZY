import React, { useState, useEffect } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import HomeScreen from './HomeScreen';
import QuizzesScreen from './QuizzesScreen';
import StudyScreen from './StudyScreen';
import HistoryScreen from './HistoryScreen';
import ProfileScreen from './ProfileScreen';

export default function MainScreen({ navigation, route }) {
  const { isGlass } = useTheme();
  const initialTab = route?.params?.initialTab || route?.params?.screen || 'Home';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [mountedTabs, setMountedTabs] = useState({
    Home: true,
    Quizzes: true,
    Study: true,
    History: true,
    Profile: true,
  });

  useEffect(() => {
    if (route?.params?.screen) {
      setActiveTab(route.params.screen);
    }
  }, [route?.params?.screen]);

  // Handle hardware back press: if not on Home, return to Home tab
  useEffect(() => {
    const onBackPress = () => {
      if (activeTab !== 'Home') {
        setActiveTab('Home');
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [activeTab]);

  const handleTabPress = (tabName) => {
    setActiveTab(tabName);
  };

  return (
    <View style={[styles.container, isGlass ? styles.containerGlass : styles.containerDark]}>
      {activeTab === 'Home' && (
        <HomeScreen
          navigation={navigation}
          route={route}
          onTabPress={handleTabPress}
          isActiveTab={true}
        />
      )}

      {activeTab === 'Quizzes' && (
        <QuizzesScreen
          navigation={navigation}
          route={route}
          onTabPress={handleTabPress}
          isActiveTab={true}
        />
      )}

      {activeTab === 'Study' && (
        <StudyScreen
          navigation={navigation}
          route={route}
          onTabPress={handleTabPress}
          isActiveTab={true}
        />
      )}

      {activeTab === 'History' && (
        <HistoryScreen
          navigation={navigation}
          route={route}
          onTabPress={handleTabPress}
          isActiveTab={true}
        />
      )}

      {activeTab === 'Profile' && (
        <ProfileScreen
          navigation={navigation}
          route={route}
          onTabPress={handleTabPress}
          isActiveTab={true}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerDark: {
    backgroundColor: '#0f172a',
  },
  containerGlass: {
    backgroundColor: '#f2f2f7',
  },
});
