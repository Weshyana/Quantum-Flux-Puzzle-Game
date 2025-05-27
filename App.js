import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Alert, PanGestureHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTailwind } from 'tailwind-rn';
import { GameEngine } from 'react-native-game-engine';

const { width, height } = Dimensions.get('window');
const PARTICLE_SIZE = 20;
const WELL_SIZE = 30;
const TARGET_SIZE = 40;
const OBSTACLE_SIZE = 50;
const INITIAL_PARTICLE = { x: 50, y: height - 50, vx: 0, vy: 0 };
const LEVEL = {
  target: { x: width - 60, y: 60 },
  obstacles: [{ x: width / 2, y: height / 2 }],
  portals: [{ in: { x: 100, y: 100 }, out: { x: width - 100, y: height - 100 } }],
  timeLimit: 30,
};

const App = () => {
  const tailwind = useTailwind();
  const [gameState, setGameState] = useState('menu');
  const [levelProgress, setLevelProgress] = useState({});
  const [timer, setTimer] = useState(LEVEL.timeLimit);
  const [entities, setEntities] = useState({
    particle: { ...INITIAL_PARTICLE, renderer: <Particle /> },
    wells: [],
    target: { ...LEVEL.target, renderer: <Target /> },
    obstacles: LEVEL.obstacles.map(obs => ({ ...obs, renderer: <Obstacle /> })),
    portals: LEVEL.portals.map(portal => ({ ...portal, renderer: <Portal /> })),
  });

  // Load progress
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const stored = await AsyncStorage.getItem('levelProgress');
        if (stored) setLevelProgress(JSON.parse(stored));
      } catch (error) {
        console.error('Error loading progress:', error);
      }
    };
    loadProgress();
  }, []);

  // Save progress
  const saveProgress = async (time) => {
    try {
      const newProgress = { ...levelProgress, 1: { bestTime: time } };
      await AsyncStorage.setItem('levelProgress', JSON.stringify(newProgress));
      setLevelProgress(newProgress);
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  // Reset progress
  const resetProgress = async () => {
    try {
      await AsyncStorage.setItem('levelProgress', JSON.stringify({}));
      setLevelProgress({});
      Alert.alert('Success', 'Progress cleared!');
    } catch (error) {
      console.error('Error resetting progress:', error);
    }
  };

  // Game systems
  const systems = {
    moveParticle: ({ entities, gestures, time }) => {
      const particle = entities.particle;
      let ax = 0, ay = 0;

      // Handle gravity wells
      gestures.forEach(gesture => {
        if (gesture.type === 'tap') {
          entities.wells.push({
            x: gesture.event.x,
            y: gesture.event.y,
            strength: 0.02,
            renderer: <Well />,
          });
        }
      });

      // Apply gravity from wells
      entities.wells.forEach(well => {
        const dx = well.x - particle.x;
        const dy = well.y - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        ax += (dx / distance) * well.strength;
        ay += (dy / distance) * well.strength;
      });

      particle.vx += ax;
      particle.vy += ay;
      particle.x += particle.vx;
      particle.y += particle.vy;

      // Check portals
      entities.portals.forEach(portal => {
        if (Math.abs(particle.x - portal.in.x) < 20 && Math.abs(particle.y - portal.in.y) < 20) {
          particle.x = portal.out.x;
          particle.y = portal.out.y;
        }
      });

      // Check boundaries
      if (particle.x < 0 || particle.x > width || particle.y < 0 || particle.y > height) {
        setGameState('gameOver');
      }

      // Update timer
      if (time.current % 1000 < 50) {
        setTimer(t => {
          if (t <= 0) {
            setGameState('gameOver');
            return 0;
          }
          return t - 1;
        });
      }

      return entities;
    },
    checkCollisions: ({ entities }) => {
      const particle = entities.particle;
      // Check obstacles
      entities.obstacles.forEach(obstacle => {
        if (
          Math.abs(particle.x - obstacle.x) < PARTICLE_SIZE &&
          Math.abs(particle.y - obstacle.y) < PARTICLE_SIZE
        ) {
          setGameState('gameOver');
        }
      });
      // Check target
      if (
        Math.abs(particle.x - entities.target.x) < TARGET_SIZE &&
        Math.abs(particle.y - entities.target.y) < TARGET_SIZE
      ) {
        setGameState('levelComplete');
        saveProgress(LEVEL.timeLimit - timer);
      }
      return entities;
    },
  };

  // Start game
  const startGame = () => {
    setGameState('playing');
    setTimer(LEVEL.timeLimit);
    setEntities({
      particle: { ...INITIAL_PARTICLE, renderer: <Particle /> },
      wells: [],
      target: { ...LEVEL.target, renderer: <Target /> },
      obstacles: LEVEL.obstacles.map(obs => ({ ...obs, renderer: <Obstacle /> })),
      portals: LEVEL.portals.map(portal => ({ ...portal, renderer: <Portal /> })),
    });
  };

  // Render components
  const Particle = () => {
    const style = useAnimatedStyle(() => ({
      transform: [
        { translateX: withTiming(entities.particle.x, { duration: 50 }) },
        { translateY: withTiming(entities.particle.y, { duration: 50 }) },
      ],
    }));
    return <Reanimated.View style={[tailwind('w-5 h-5 bg-cyan-400 rounded-full'), style]} />;
  };

  const Well = () => {
    const style = useAnimatedStyle(() => ({
      transform: [
        { translateX: withTiming(entities.wells[0]?.x || 0, { duration: 50 }) },
        { translateY: withTiming(entities.wells[0]?.y || 0, { duration: 50 }) },
      ],
    }));
    return <Reanimated.View style={[tailwind('w-8 h-8 bg-blue-500 opacity-50 rounded-full'), style]} />;
  };

  const Target = () => {
    const style = useAnimatedStyle(() => ({
      transform: [
        { translateX: withTiming(entities.target.x, { duration: 50 }) },
        { translateY: withTiming(entities.target.y, { duration: 50 }) },
      ],
    }));
    return <Reanimated.View style={[tailwind('w-10 h-10 bg-green-500 rounded-full'), style]} />;
  };

  const Obstacle = () => {
    const style = useAnimatedStyle(() => ({
      transform: [
        { translateX: withTiming(entities.obstacles[0]?.x || 0, { duration: 50 }) },
        { translateY: withTiming(entities.obstacles[0]?.y || 0, { duration: 50 }) },
      ],
    }));
    return <Reanimated.View style={[tailwind('w-12 h-12 bg-red-500'), style]} />;
  };

  const Portal = () => {
    const styleIn = useAnimatedStyle(() => ({
      transform: [
        { translateX: withTiming(entities.portals[0]?.in.x || 0, { duration: 50 }) },
        { translateY: withTiming(entities.portals[0]?.in.y || 0, { duration: 50 }) },
      ],
    }));
    const styleOut = useAnimatedStyle(() => ({
      transform: [
        { translateX: withTiming(entities.portals[0]?.out.x || 0, { duration: 50 }) },
        { translateY: withTiming(entities.portals[0]?.out.y || 0, { duration: 50 }) },
      ],
    }));
    return (
      <>
        <Reanimated.View style={[tailwind('w-8 h-8 bg-purple-500 rounded-full'), styleIn]} />
        <Reanimated.View style={[tailwind('w-8 h-8 bg-purple-500 rounded-full'), styleOut]} />
      </>
    );
  };

  // Handle gestures
  const onGestureEvent = event => {
    systems.moveParticle({ entities, gestures: [{ type: 'tap', event: event.nativeEvent }], time: { current: Date.now() } });
  };

  // Render screens
  const renderMenu = () => (
    <View style={tailwind('flex-1 justify-center items-center bg-gray-900')}>
      <Text style={tailwind('text-4xl text-cyan-400 mb-8')}>Quantum Flux</Text>
      <TouchableOpacity style={tailwind('bg-cyan-500 p-4 rounded-lg mb-4')} onPress={startGame}>
        <Text style={tailwind('text-white text-lg')}>Start Level</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={tailwind('bg-gray-500 p-4 rounded-lg mb-4')}
        onPress={() => setGameState('progress')}
      >
        <Text style={tailwind('text-white text-lg')}>Level Progress</Text>
      </TouchableOpacity>
      <TouchableOpacity style={tailwind('bg-red-500 p-4 rounded-lg')} onPress={resetProgress}>
        <Text style={tailwind('text-white text-lg')}>Reset Progress</Text>
      </TouchableOpacity>
    </View>
  );

  const renderGame = () => (
    <PanGestureHandler onGestureEvent={onGestureEvent}>
      <View style={tailwind('flex-1 bg-gray-900')}>
        <GameEngine
          style={tailwind('flex-1')}
          systems={[systems.moveParticle, systems.checkCollisions]}
          entities={entities}
          running={gameState === 'playing'}
        />
        <Text style={tailwind('text-cyan-400 text-2xl absolute top-4 left-4')}>
          Time: {timer}s
        </Text>
      </View>
    </PanGestureHandler>
  );

  const renderProgress = () => (
    <View style={tailwind('flex-1 justify-center items-center bg-gray-900')}>
      <Text style={tailwind('text-3xl text-cyan-400 mb-4')}>Level Progress</Text>
      {Object.keys(levelProgress).length ? (
        Object.entries(levelProgress).map(([level, data]) => (
          <Text key={level} style={tailwind('text-lg text-white')}>
            Level {level}: {data.bestTime}s
          </Text>
        ))
      ) : (
        <Text style={tailwind('text-lg text-white')}>No levels completed yet.</Text>
      )}
      <TouchableOpacity
        style={tailwind('bg-cyan-500 p-4 rounded-lg mt-4')}
        onPress={() => setGameState('menu')}
      >
        <Text style={tailwind('text-white text-lg')}>Back to Menu</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLevelComplete = () => (
    <View style={tailwind('flex-1 justify-center items-center bg-gray-900')}>
      <Text style={tailwind('text-3xl text-cyan-400 mb-4')}>Level Complete!</Text>
      <Text style={tailwind('text-2xl text-white mb-8')}>
        Time: {LEVEL.timeLimit - timer}s
      </Text>
      <TouchableOpacity style={tailwind('bg-cyan-500 p-4 rounded-lg mb-4')} onPress={startGame}>
        <Text style={tailwind('text-white text-lg')}>Replay Level</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={tailwind('bg-gray-500 p-4 rounded-lg')}
        onPress={() => setGameState('menu')}
      >
        <Text style={tailwind('text-white text-lg')}>Main Menu</Text>
      </TouchableOpacity>
    </View>
  );

  const renderGameOver = () => (
    <View style={tailwind('flex-1 justify-center items-center bg-gray-900')}>
      <Text style={tailwind('text-3xl text-cyan-400 mb-4')}>Level Failed!</Text>
      <Text style={tailwind('text-2xl text-white mb-8')}>Time: {timer}s</Text>
      <TouchableOpacity style={tailwind('bg-cyan-500 p-4 rounded-lg mb-4')} onPress={startGame}>
        <Text style={tailwind('text-white text-lg')}>Try Again</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={tailwind('bg-gray-500 p-4 rounded-lg')}
        onPress={() => setGameState('menu')}
      >
        <Text style={tailwind('text-white text-lg')}>Main Menu</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={tailwind('flex-1')}>
      {gameState === 'menu' && renderMenu()}
      {gameState === 'playing' && renderGame()}
      {gameState === 'progress' && renderProgress()}
      {gameState === 'levelComplete' && renderLevelComplete()}
      {gameState === 'gameOver' && renderGameOver()}
    </View>
  );
};

export default App;
