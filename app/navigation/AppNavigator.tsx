import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import RecordScreen from '../screens/record/RecordScreen';
import ImportScreen from '../screens/import/ImportScreen';
import ImportProgressScreen from '../screens/import/ImportProgressScreen';
import CanvasEditor from '../screens/CanvasEditor';

const Stack = createStackNavigator();

const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Dashboard">
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Record" component={RecordScreen} />
        <Stack.Screen name="Import" component={ImportScreen} />
        <Stack.Screen name="ImportProgress" component={ImportProgressScreen} />
        <Stack.Screen name="CanvasEditor" component={CanvasEditor} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 