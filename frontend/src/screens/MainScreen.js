import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import HomeScreen from './HomeScreen';
import QuizzesScreen from './QuizzesScreen';
import StudyScreen from './StudyScreen';
import HistoryScreen from './HistoryScreen';
import ProfileScreen from './ProfileScreen';
import BottomTabBar from '../components/BottomTabBar';

export default function MainScreen({ navigation, route }) {
  const { isGlass } = useTheme();

  const resolveTabName = (r) => {
    if (r?.params?.screen && ['Home', 'Quizzes', 'Study', 'History', 'Profile'].includes(r.params.screen)) {
      return r.params.screen;
    }
    if (r?.params?.initialTab && ['Home', 'Quizzes', 'Study', 'History', 'Profile'].includes(r.params.initialTab)) {
      return r.params.initialTab;
    }
    if (r?.name && ['Home', 'Quizzes', 'Study', 'History', 'Profile'].includes(r.name)) {
      return r.name;
    }
    return 'Home';
  };

  const initialTab = resolveTabName(route);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [visitedTabs, setVisitedTabs] = useState({ [initialTab]: true });
  const [isReaderMode, setIsReaderMode] = useState(false);

  useEffect(() => {
    const nextTab = resolveTabName(route);
    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab);
      setVisitedTabs((prev) => (prev[nextTab] ? prev : { ...prev, [nextTab]: true }));
    }
  }, [route]);

  // Handle hardware back press: if not on Home, return to Home tab
  useEffect(() => {
    const onBackPress = () => {
      // If reader mode is active on study screen, StudyScreen's internal back handler handles it first
      if (activeTab !== 'Home' && (!isReaderMode || activeTab !== 'Study')) {
        setActiveTab('Home');
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [activeTab, isReaderMode]);

  const handleTabPress = useCallback((tabName) => {
    setActiveTab(tabName);
    setVisitedTabs((prev) => (prev[tabName] ? prev : { ...prev, [tabName]: true }));
  }, []);

  const showBottomBar = !isReaderMode || activeTab !== 'Study';

  return (
    <View style={[styles.container, isGlass ? styles.containerGlass : styles.containerDark]}>
      <View style={styles.screensContainer}>
        {visitedTabs.Home && (
          <View
            style={[
              styles.screenWrapper,
              activeTab === 'Home' ? styles.visibleScreen : styles.hiddenScreen,
            ]}
          >
            <HomeScreen
              navigation={navigation}
              route={route}
              onTabPress={handleTabPress}
              isActiveTab={activeTab === 'Home'}
              hideBottomBar={true}
            />
          </View>
        )}

        {visitedTabs.Quizzes && (
          <View
            style={[
              styles.screenWrapper,
              activeTab === 'Quizzes' ? styles.visibleScreen : styles.hiddenScreen,
            ]}
          >
            <QuizzesScreen
              navigation={navigation}
              route={route}
              onTabPress={handleTabPress}
              isActiveTab={activeTab === 'Quizzes'}
              hideBottomBar={true}
            />
          </View>
        )}

        {visitedTabs.Study && (
          <View
            style={[
              styles.screenWrapper,
              activeTab === 'Study' ? styles.visibleScreen : styles.hiddenScreen,
            ]}
          >
            <StudyScreen
              navigation={navigation}
              route={route}
              onTabPress={handleTabPress}
              isActiveTab={activeTab === 'Study'}
              hideBottomBar={true}
              onReaderModeChange={setIsReaderMode}
            />
          </View>
        )}

        {visitedTabs.History && (
          <View
            style={[
              styles.screenWrapper,
              activeTab === 'History' ? styles.visibleScreen : styles.hiddenScreen,
            ]}
          >
            <HistoryScreen
              navigation={navigation}
              route={route}
              onTabPress={handleTabPress}
              isActiveTab={activeTab === 'History'}
              hideBottomBar={true}
            />
          </View>
        )}

        {visitedTabs.Profile && (
          <View
            style={[
              styles.screenWrapper,
              activeTab === 'Profile' ? styles.visibleScreen : styles.hiddenScreen,
            ]}
          >
            <ProfileScreen
              navigation={navigation}
              route={route}
              onTabPress={handleTabPress}
              isActiveTab={activeTab === 'Profile'}
              hideBottomBar={true}
            />
          </View>
        )}
      </View>

      {showBottomBar && (
        <BottomTabBar
          activeTab={activeTab}
          onTabPress={handleTabPress}
          onStudyPress={() => handleTabPress('Study')}
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
  screensContainer: {
    flex: 1,
    position: 'relative',
  },
  screenWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  visibleScreen: {
    display: 'flex',
  },
  hiddenScreen: {
    display: 'none',
  },
});
