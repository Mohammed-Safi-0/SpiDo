import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, LayoutAnimation, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const TASKS_STORAGE_KEY = '@neighborhood-patrol-tasks';

async function requestReminderPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('task-reminders', {
      name: 'Task reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();

  if (status !== 'granted') {
    const permission = await Notifications.requestPermissionsAsync();
    status = permission.status;
  }

  return status === 'granted';
}

async function scheduleTaskReminder(title, reminderDate, repeat = 'never') {
  if (!reminderDate) return null;

  const hasPermission = await requestReminderPermission();

  if (!hasPermission) return null;

  if (Platform.OS === 'android') {
    const alarmPermission =
      await Notifications.getExactAlarmPermissionsAsync();

    if (!alarmPermission.granted) {
      await Notifications.requestExactAlarmPermissionsAsync();

      const updatedPermission =
        await Notifications.getExactAlarmPermissionsAsync();

      if (!updatedPermission.granted) {
        console.warn('Exact alarm permission not granted.');
      }
    }
  }

  let trigger;

  if (repeat === 'daily') {
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: reminderDate.getHours(),
      minute: reminderDate.getMinutes(),
      channelId: 'task-reminders',
      ...(Platform.OS === 'android'
        ? { delivery: 'bestEffort' }
        : {}),
    };

  } else if (repeat === 'weekly') {
    trigger = {
      type: Platform.OS === 'ios'
        ? Notifications.SchedulableTriggerInputTypes.CALENDAR
        : Notifications.SchedulableTriggerInputTypes.WEEKLY,

      ...(Platform.OS === 'ios'
        ? {
            weekday: reminderDate.getDay() + 1,
            repeats: true,
          }
        : {
            weekday: reminderDate.getDay() + 1,
            channelId: 'task-reminders',
            delivery: 'bestEffort',
          }),

      hour: reminderDate.getHours(),
      minute: reminderDate.getMinutes(),
    };

  } else {
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
      channelId: 'task-reminders',
    };
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Neighborhood Patrol reminder',
      body: `It's time to: ${title}`,
    },
    trigger,
  });
}

function getRepeatLabel(repeat, reminderDate) {
  if (repeat === 'daily') return 'Repeats daily';
  if (repeat === 'weekly' && reminderDate) {
    return `Repeats every ${reminderDate.toLocaleDateString(undefined, { weekday: 'long' })}`;
  }
  return null;
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [taskFormVisible, setTaskFormVisible] = useState(false);
  const [taskDetails, setTaskDetails] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftReminder, setDraftReminder] = useState(null);
  const [draftRepeat, setDraftRepeat] = useState('never');
  const [reminderPickerMode, setReminderPickerMode] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTasks() {
      try {
        const savedTasks = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
        if (savedTasks && isMounted) {
          setTasks(JSON.parse(savedTasks));
        }
      } catch (error) {
        console.warn('Could not load saved tasks:', error);
      } finally {
        if (isMounted) {
          setTasksLoaded(true);
        }
      }
    }

    loadTasks();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!tasksLoaded) return;

    AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks)).catch((error) => {
      console.warn('Could not save tasks:', error);
    });
  }, [tasks, tasksLoaded]);
  const slideX = useRef(new Animated.Value(0)).current;
  const webVisible = useRef(new Animated.Value(0)).current;
  const tileWobble = useRef(new Animated.Value(0)).current;
  const tileWobbleRotation = tileWobble.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: ['0deg', '-2.5deg', '2.5deg', '-1deg', '0deg'],
  });

  const animateTileWobble = () => {
    tileWobble.setValue(0);
    Animated.sequence([
      Animated.timing(tileWobble, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(tileWobble, {
        toValue: 2,
        duration: 110,
        useNativeDriver: true,
      }),
      Animated.timing(tileWobble, {
        toValue: 3,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(tileWobble, {
        toValue: 4,
        duration: 110,
        useNativeDriver: true,
      }),
    ]).start(() => tileWobble.setValue(0));
  };

  const visibleTasks = tasks.filter(
    (task) => task.completed === showCompleted
  );

  const openNewTask = () => {
  setEditingTaskId(null);
  setDraftTitle('');
  setDraftNotes('');
  setDraftReminder(null);
  setDraftRepeat('never');
  setTaskFormVisible(true);
};

  const openTaskDetails = (task) => {
    setTaskDetails(task);
  };

  const openEditTask = (task) => {
    setTaskDetails(null);
    setEditingTaskId(task.id);
    setDraftTitle(task.title);
    setDraftNotes(task.notes || '');
    setDraftReminder(
    task.reminderDate ? new Date(task.reminderDate) : null);
    setDraftRepeat(task.repeat || 'never');
    setTaskFormVisible(true);
  };

  const saveTask = async () => {
  const title = draftTitle.trim();

  if (!title) {
    Alert.alert('Add a title', 'Please enter a task name first.');
    return;
  }

  if (draftRepeat !== 'never' && !draftReminder) {
    Alert.alert('Choose a reminder time', 'Set a date and time before choosing a repeat schedule.');
    return;
  }

  if (draftRepeat === 'never' && draftReminder && draftReminder.getTime() <= Date.now()) {
    Alert.alert('Choose a future time', 'The reminder must be in the future.');
    return;
  }

  const existingTask = tasks.find((task) => task.id === editingTaskId);

  try {
    let notificationId = null;

    if (draftReminder) {
      notificationId = await scheduleTaskReminder(title, draftReminder, draftRepeat);
    }

    if (existingTask?.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(
        existingTask.notificationId
      );
    }

    const reminderDate = draftReminder
      ? draftReminder.toISOString()
      : null;

    if (editingTaskId) {
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === editingTaskId
            ? {
                ...task,
                title,
                notes: draftNotes.trim(),
                reminderDate,
                repeat: draftRepeat,
                notificationId,
              }
            : task
        )
      );
    } else {
      setTasks((currentTasks) => [
        {
          id: Date.now().toString(),
          title,
          notes: draftNotes.trim(),
          reminderDate,
          repeat: draftRepeat,
          notificationId,
          completed: false,
        },
        ...currentTasks,
      ]);
    }

    setTaskFormVisible(false);
    setEditingTaskId(null);
    setDraftTitle('');
    setDraftNotes('');
    setDraftReminder(null);
    setDraftRepeat('never');

    if (draftReminder && !notificationId) {
      Alert.alert(
        'Task saved without a reminder',
        'Notifications were not allowed, so the reminder was not scheduled.'
      );
    }
  } catch (error) {
    console.warn('Could not save task reminder:', error);
    Alert.alert(
      'Could not save task',
      'Something went wrong while scheduling the reminder. Please try again.'
    );
  }
};

 const deleteTask = (task) => {
  Alert.alert('Delete task?', `“${task.title}” will be removed.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: async () => {
        try {
          if (task.notificationId) {
            await Notifications.cancelScheduledNotificationAsync(
              task.notificationId
            );
          }
        } catch (error) {
          console.warn('Could not cancel task reminder:', error);
          Alert.alert(
            'Could not delete task',
            'The reminder could not be canceled. Please try again.'
          );
          return;
        }

        setTasks((currentTasks) =>
          currentTasks.filter((item) => item.id !== task.id)
        );
        setSelectedTaskIds((currentIds) =>
          currentIds.filter((id) => id !== task.id)
        );
        setTaskDetails(null);
      },
    },
  ]);
};

const deleteAllCompletedTasks = () => {
  const completedTasks = tasks.filter((task) => task.completed);
  if (completedTasks.length === 0) return;

  Alert.alert(
    'Delete all completed tasks?',
    `This will permanently remove ${completedTasks.length} completed task${completedTasks.length === 1 ? '' : 's'}.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: async () => {
          for (const task of completedTasks) {
            if (!task.notificationId) continue;

            try {
              await Notifications.cancelScheduledNotificationAsync(
                task.notificationId
              );
            } catch (error) {
              console.warn(
                'Could not cancel completed task reminder:',
                error
              );
              Alert.alert(
                'Could not delete completed tasks',
                'A reminder could not be canceled, so no tasks were removed. Please try again.'
              );
              return;
            }
          }

          const completedIds = new Set(
            completedTasks.map((task) => task.id)
          );
          setTasks((currentTasks) =>
            currentTasks.filter((task) => !completedIds.has(task.id))
          );
          setSelectedTaskIds((currentIds) =>
            currentIds.filter((id) => !completedIds.has(id))
          );
          setTaskDetails((currentTask) =>
            currentTask && completedIds.has(currentTask.id)
              ? null
              : currentTask
          );
        },
      },
    ],
    { cancelable: true }
  );
};

    const restoreTask = async (task) => {
  let notificationId = null;

  const reminderDate = task.reminderDate
    ? new Date(task.reminderDate)
    : null;

  if (reminderDate && (task.repeat && task.repeat !== 'never' || reminderDate.getTime() > Date.now())) {
    try {
      notificationId = await scheduleTaskReminder(
        task.title,
        reminderDate,
        task.repeat || 'never'
      );
    } catch (error) {
      console.warn('Could not reschedule task reminder:', error);
    }

    if (!notificationId) {
      Alert.alert(
        'Task restored without a reminder',
        'Notifications were not allowed, so the reminder was not scheduled.'
      );
    }
  }

  LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
  animateTileWobble();

  setTasks((currentTasks) =>
    currentTasks.map((item) =>
      item.id === task.id
        ? { ...item, completed: false, notificationId }
        : item
    )
  );

  setTaskDetails(null);
};
  const toggleTaskSelection = (taskId) => {
    setSelectedTaskIds((currentIds) =>
      currentIds.includes(taskId)
        ? currentIds.filter((id) => id !== taskId)
        : [...currentIds, taskId]
    );
  };

  const completeSelectedTasks = () => {
    if (selectedTaskIds.length === 0) return;

    Animated.sequence([
      Animated.timing(webVisible, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.delay(150),
      Animated.timing(slideX, {
        toValue: 420,
        duration: 550,
        useNativeDriver: true,
      }),
    ]).start(async ({ finished }) => {
  if (!finished) return;

  for (const task of tasks) {
    if (selectedTaskIds.includes(task.id) && task.notificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(
          task.notificationId
        );
      } catch (error) {
        console.warn('Could not cancel completed task reminder:', error);
      }
    }
  }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
      animateTileWobble();

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          selectedTaskIds.includes(task.id)
            ? { ...task, completed: true }
            : task
        )
      );

      setSelectedTaskIds([]);
      slideX.setValue(0);
      webVisible.setValue(0);
    });
  };
  return (
    <View style={styles.screen}>
      <Image
        source={require('./assets/bgimage.png')}
        resizeMode="cover"
        style={styles.backgroundImage}
      />

            <View style={styles.header}>
        <Text style={styles.title}>Neighborhood Patrol</Text>
        <Text style={styles.subtitle}>Small tasks. Big neighborhood energy.</Text>
      </View>

      <View
        style={[
          styles.content,
          showCompleted && styles.contentWithDeleteAll,
        ]}
      >
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tabButton, !showCompleted && styles.activeTab]}
            onPress={() => {
              setShowCompleted(false);
              setSelectedTaskIds([]);
            }}
          >
            <Text style={styles.tabText}>
              To do ({tasks.filter((task) => !task.completed).length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabButton, showCompleted && styles.activeTab]}
            onPress={() => {
              setShowCompleted(true);
              setSelectedTaskIds([]);
            }}
          >
            <Text style={styles.tabText}>
              Completed ({tasks.filter((task) => task.completed).length})
            </Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          {showCompleted
            ? 'Your completed tasks are saved here.'
            : 'Tap a circle to select tasks, or tap a task to read it.'}
        </Text>

        <ScrollView contentContainerStyle={styles.taskList}>
          {visibleTasks.map((task) => {
            const selected = selectedTaskIds.includes(task.id);

            return (
              <Animated.View
                key={task.id}
                style={[
                  styles.taskCard,
                  {
                    transform: [
                      ...(selected ? [{ translateX: slideX }] : []),
                      { rotate: tileWobbleRotation },
                    ],
                  },
                ]}
              >
                <Pressable
                  style={styles.checkButton}
                  onPress={() => {
                    if (showCompleted) {
                      restoreTask(task);
                    } else {
                      toggleTaskSelection(task.id);
                    }
                  }}
                >
                  <View
                    style={[
                      styles.checkbox,
                      (selected || task.completed) && styles.checkedBox,
                    ]}
                  >
                    {(selected || task.completed) && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                </Pressable>

                <Pressable
                  style={styles.taskTextArea}
                  onPress={() => openTaskDetails(task)}
                >
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  {!!getRepeatLabel(task.repeat, task.reminderDate ? new Date(task.reminderDate) : null) && (
                    <Text style={styles.taskRepeat}>
                      {getRepeatLabel(task.repeat, task.reminderDate ? new Date(task.reminderDate) : null)}
                    </Text>
                  )}
                  {!!task.notes && (
                    <Text style={styles.taskNotes} numberOfLines={2}>
                      {task.notes}
                    </Text>
                  )}
                </Pressable>
                     {selected && (<Animated.View
  pointerEvents="none"
  style={[
    styles.webStrand,
    {
      opacity: webVisible,
    },
  ]}
>
    <Svg width="220" height="90" viewBox="0 0 220 90">
  {/* Curved connector loops */}
  <Path
    d="M 62 45 C 80 45, 84 36, 104 36 C 124 36, 130 45, 148 45 C 165 45, 171 39, 192 39 C 205 39, 213 45, 219 45"
    stroke="#ffffff"
    strokeWidth={1}
    strokeLinecap="round"
    fill="none"
  />
  <Path
    d="M 62 45 C 80 45, 84 54, 104 54 C 124 54, 130 45, 148 45 C 165 45, 171 51, 192 51 C 205 51, 213 45, 219 45"
    stroke="#ffffff"
    strokeWidth={1}
    strokeLinecap="round"
    fill="none"
  />
  <Path
    d="M 62 45 C 85 43, 95 42, 108 45 C 125 48, 135 47, 148 45 C 166 43, 181 43, 192 45 C 205 47, 213 45, 219 45"
    stroke="#ffffff"
    strokeWidth={0.6}
    opacity={0.7}
    fill="none"
  />
  <Path
    d="M 62 45 C 85 47, 95 48, 108 45 C 125 42, 135 43, 148 45 C 166 47, 181 47, 192 45 C 205 43, 213 45, 219 45"
    stroke="#ffffff"
    strokeWidth={0.6}
    opacity={0.7}
    fill="none"
  />
  <Path
    d="M 84 39 C 87 42, 87 48, 84 51"
    stroke="#ffffff"
    strokeWidth={0.6}
    opacity={0.7}
    fill="none"
  />
  <Path
    d="M 104 36 C 107 41, 107 49, 104 54"
    stroke="#ffffff"
    strokeWidth={0.6}
    opacity={0.7}
    fill="none"
  />

  {/* Curved strands spreading from the joining point */}
  <Path
    d="M 12 14 C 28 19, 46 36, 62 45"
    stroke="#ffffff"
    strokeWidth={0.8}
    strokeLinecap="round"
    fill="none"
  />
  <Path
    d="M 12 27 C 29 32, 46 40, 62 45"
    stroke="#ffffff"
    strokeWidth={0.8}
    strokeLinecap="round"
    fill="none"
  />
  <Path
    d="M 12 42 C 30 44, 46 45, 62 45"
    stroke="#ffffff"
    strokeWidth={0.8}
    strokeLinecap="round"
    fill="none"
  />
  <Path
    d="M 12 52 C 29 51, 46 47, 62 45"
    stroke="#ffffff"
    strokeWidth={0.8}
    strokeLinecap="round"
    fill="none"
  />
  <Path
    d="M 12 65 C 28 61, 46 52, 62 45"
    stroke="#ffffff"
    strokeWidth={0.8}
    strokeLinecap="round"
    fill="none"
  />
  <Path
    d="M 12 78 C 28 69, 46 56, 62 45"
    stroke="#ffffff"
    strokeWidth={0.8}
    strokeLinecap="round"
    fill="none"
  />

  {/* Small curved cross-strands */}
  <Path
    d="M 24 22 C 30 21, 34 31, 40 32"
    stroke="#ffffff"
    strokeWidth={0.6}
    opacity={0.7}
    fill="none"
  />
  <Path
    d="M 22 33 C 29 31, 37 42, 44 41"
    stroke="#ffffff"
    strokeWidth={0.6}
    opacity={0.7}
    fill="none"
  />
  <Path
    d="M 22 52 C 29 54, 37 45, 44 47"
    stroke="#ffffff"
    strokeWidth={0.6}
    opacity={0.7}
    fill="none"
  />
  <Path
    d="M 24 62 C 30 65, 37 52, 43 53"
    stroke="#ffffff"
    strokeWidth={0.6}
    opacity={0.7}
    fill="none"
  />
</Svg>
</Animated.View>)}
              </Animated.View>
            );
          })}

          {visibleTasks.length === 0 && (
            <Text style={styles.emptyMessage}>
              {showCompleted
                ? 'No completed tasks yet.'
                : 'No tasks yet. Add one to get started.'}
            </Text>
          )}
        </ScrollView>
      </View>

      {!showCompleted && selectedTaskIds.length > 0 && (
        <Pressable
          style={styles.completeButton}
          onPress={completeSelectedTasks}
        >
          <Text style={styles.buttonText}>
            Complete selected ({selectedTaskIds.length})  ✓
          </Text>
        </Pressable>
      )}

      {showCompleted && (
        <Pressable
          style={[
            styles.deleteAllButton,
            tasks.some((task) => task.completed) && styles.deleteAllButtonEnabled,
          ]}
          onPress={deleteAllCompletedTasks}
          disabled={!tasks.some((task) => task.completed)}
        >
          <Text style={styles.buttonText}>Delete all completed tasks</Text>
        </Pressable>
      )}

      <Pressable style={styles.addButton} onPress={openNewTask}>
        <Text style={styles.buttonText}>＋ Add a task</Text>
      </Pressable>

      <Modal
        visible={taskFormVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTaskFormVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingTaskId ? 'Edit task' : 'New task'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Task name"
              placeholderTextColor="#cccccc"
              value={draftTitle}
              onChangeText={setDraftTitle}
            />

            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Notes (optional)"
              placeholderTextColor="#cccccc"
              value={draftNotes}
              onChangeText={setDraftNotes}
              multiline
            />
            <View style={styles.reminderRow}>
  <Pressable
    style={styles.reminderButton}
    onPress={() => {
      if (!draftReminder) {
        setDraftReminder(new Date(Date.now() + 60 * 60 * 1000));
      }
      setReminderPickerMode('date');
    }}
  >
    <Text style={styles.buttonText}>
      {draftReminder
        ? `Date: ${draftReminder.toLocaleDateString()}`
        : 'Choose date'}
    </Text>
  </Pressable>

  <Pressable
    style={styles.reminderButton}
    onPress={() => {
      if (!draftReminder) {
        setDraftReminder(new Date(Date.now() + 60 * 60 * 1000));
      }
      setReminderPickerMode('time');
    }}
  >
    <Text style={styles.buttonText}>
      {draftReminder
        ? `Time: ${draftReminder.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })}`
        : 'Choose time'}
    </Text>
  </Pressable>
</View>

<Text style={styles.repeatLabel}>Repeat reminder</Text>
<View style={styles.repeatOptions}>
  {[
    { value: 'never', label: 'Never' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
  ].map((option) => (
    <Pressable
      key={option.value}
      style={[styles.repeatOption, draftRepeat === option.value && styles.repeatOptionSelected]}
      onPress={() => setDraftRepeat(option.value)}
    >
      <Text style={styles.buttonText}>{option.label}</Text>
    </Pressable>
  ))}
</View>
<Text style={styles.repeatHint}>
  {draftRepeat === 'daily'
    ? 'Repeats every day at the selected time.'
    : draftRepeat === 'weekly'
      ? `Repeats every ${draftReminder ? draftReminder.toLocaleDateString(undefined, { weekday: 'long' }) : 'selected weekday'} at the selected time.`
      : 'This reminder happens once.'}
</Text>

{reminderPickerMode && (
  <DateTimePicker
    value={draftReminder || new Date(Date.now() + 60 * 60 * 1000)}
    mode={reminderPickerMode}
    presentation="dialog"
    onValueChange={(event, selectedDate) => {
      const chosenMode = reminderPickerMode;
      setReminderPickerMode(null);

      if (!selectedDate) return;

      setDraftReminder((currentReminder) => {
        const updatedDate = new Date(
          currentReminder || Date.now() + 60 * 60 * 1000
        );

        if (chosenMode === 'date') {
          updatedDate.setFullYear(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate()
          );
        } else {
          updatedDate.setHours(
            selectedDate.getHours(),
            selectedDate.getMinutes(),
            0,
            0
          );
        }

        return updatedDate;
      });
    }}
    onDismiss={() => setReminderPickerMode(null)}
  />
)}

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setTaskFormVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>

              <Pressable style={styles.addButtonSmall} onPress={saveTask}>
                <Text style={styles.buttonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!taskDetails}
        transparent
        animationType="fade"
        onRequestClose={() => setTaskDetails(null)}
      >
        <View style={styles.modalBackdrop}>
          {taskDetails && (
            <View style={[styles.modalCard, styles.detailsModalCard]}>
              <Text style={styles.modalTitle}>{taskDetails.title}</Text>
              {!!getRepeatLabel(taskDetails.repeat, taskDetails.reminderDate ? new Date(taskDetails.reminderDate) : null) && (
                <Text style={styles.detailRepeat}>
                  {getRepeatLabel(taskDetails.repeat, new Date(taskDetails.reminderDate))}
                  {taskDetails.reminderDate ? ` at ${new Date(taskDetails.reminderDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
                </Text>
              )}
              <ScrollView
                style={styles.detailNotesScroll}
                showsVerticalScrollIndicator
              >
                <Text style={styles.detailNotes}>
                  {taskDetails.notes || 'No notes for this task.'}
                </Text>
              </ScrollView>

              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setTaskDetails(null)}
                >
                  <Text style={styles.buttonText}>Close</Text>
                </Pressable>
                
                <Pressable
                  style={styles.addButtonSmall}
                  onPress={() => openEditTask(taskDetails)}
                >
                  <Text style={styles.buttonText}>Edit</Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.deleteButton}
                onPress={() => deleteTask(taskDetails)}
              >
                <Text style={styles.buttonText}>Delete task</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </View>
    
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 24,
    right: 24,
    zIndex: 2,
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 5,
  },
  content: {
    position: 'absolute',
    top: 145,
    bottom: 100,
    left: 20,
    right: 20,
    zIndex: 2,
  },
  contentWithDeleteAll: {
    bottom: 154,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: 'rgba(190, 28, 45, 0.8)',
  },
  tabText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    marginTop: 14,
    marginBottom: 12,
  },
  taskList: {
    paddingBottom: 20,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },
  checkButton: {
    padding: 8,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedBox: {
    backgroundColor: 'rgba(190, 28, 45, 0.9)',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  taskTextArea: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 8,
  },
  taskTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  taskNotes: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginTop: 4,
  },
  taskRepeat: {
    color: '#ffd166',
    fontSize: 12,
    marginTop: 4,
  },
  emptyMessage: {
    color: '#ffffff',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 36,
  },
  completeButton: {
    position: 'absolute',
    bottom: 88,
    left: 24,
    right: 24,
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(190, 28, 45, 0.9)',
    zIndex: 4,
  },
  deleteAllButton: {
    position: 'absolute',
    bottom: 88,
    left: 24,
    right: 24,
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120, 20, 30, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 4,
  },
  deleteAllButtonEnabled: {
    backgroundColor: 'rgba(120, 20, 30, 0.95)',
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    right: 24,
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(190, 28, 45, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    zIndex: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalCard: {
    width: '100%',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: 'rgba(25, 25, 25, 0.98)',
  },
  detailsModalCard: {
    maxHeight: '85%',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    fontSize: 16,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
reminderRow: {
  flexDirection: 'row',
  gap: 8,
  marginBottom: 12,
},
reminderButton: {
  flex: 1,
  minHeight: 50,
  paddingHorizontal: 8,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.35)',
  alignItems: 'center',
  justifyContent: 'center',
},
repeatLabel: {
  color: '#ffffff',
  fontSize: 14,
  fontWeight: '700',
  marginBottom: 8,
},
repeatOptions: {
  flexDirection: 'row',
  gap: 8,
},
repeatOption: {
  flex: 1,
  minHeight: 44,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.35)',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
},
repeatOptionSelected: {
  backgroundColor: 'rgba(190, 28, 45, 0.9)',
  borderColor: 'rgba(255, 255, 255, 0.65)',
},
repeatHint: {
  color: 'rgba(255, 255, 255, 0.75)',
  fontSize: 12,
  marginTop: 8,
  marginBottom: 12,
},
detailRepeat: {
  color: '#ffd166',
  fontSize: 14,
  marginTop: -8,
  marginBottom: 12,
},
  detailNotes: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 16,
    lineHeight: 23,
  },
  detailNotesScroll: {
    flexShrink: 1,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  addButtonSmall: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(190, 28, 45, 0.9)',
  },
  deleteButton: {
    minHeight: 48,
    marginTop: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120, 20, 30, 0.9)',
  },
  webStrand: {
    position: 'absolute',
    top: '50%',
    right: 0,
    width: 220,
    height: 90,
    marginTop: -45,
    zIndex: 3,
  },
});
