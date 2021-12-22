import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/auth";
import { useAuthState } from "react-firebase-hooks/auth";
import { useCollectionData, useDocument } from "react-firebase-hooks/firestore";
import {
  ChakraProvider,
  Flex,
  Text,
  Button,
  Box,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Input,
  Progress,
  OrderedList,
  ListItem,
  Select,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { EditIcon, WarningTwoIcon } from "@chakra-ui/icons";
import { useState, useEffect, useCallback } from "react";
import moment from "moment";

if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: process.env.REACT_APP_API_KEY,
    authDomain: process.env.REACT_APP_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_PROJECT_ID,
    storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_APP_ID,
  });
}

const auth = firebase.auth();
const firestore = firebase.firestore();

function App() {
  const [user] = useAuthState(auth);
  return (
    <ChakraProvider>
      <div>
        <section>{user ? <GameWaitingRoom /> : <SignIn />}</section>
      </div>
    </ChakraProvider>
  );
}

function SignIn() {
  const signInWithGoogle = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then(async (result) => {
      const user = result.user;
      const playersRef = firestore.collection("players").doc(user?.uid);
      const player = await playersRef.get();
      const logsRef = firestore
        .collection("logs")
        .doc(new Date().toISOString());
      if (!player.exists)
        await playersRef.set({
          joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
          name: user?.displayName,
          uid: user?.uid,
          ready: false,
          inGame: false,
          role: "player",
          random: Math.floor(Math.random() * 999999 + 1),
        });
      await logsRef.set({
        name: user?.displayName,
        uid: user?.uid,
        action: "register",
      });
    });
  };
  return (
    <Flex
      width="100vw"
      height="100vh"
      alignItems="center"
      justifyContent="center"
    >
      <Button onClick={signInWithGoogle} colorScheme="blue">
        Prisijungti
      </Button>
    </Flex>
  );
}

function GameWaitingRoom() {
  const playersRef = firestore.collection("players").where("role", "!=", "dq");
  const allPlayersRef = firestore.collection("players");
  const [players] = useCollectionData(playersRef, { idField: "id" });
  const [allPlayers] = useCollectionData(allPlayersRef, { idField: "id" });
  const playersReadyRef = firestore
    .collection("players")
    .where("ready", "==", true);
  const [playersReady] = useCollectionData(playersReadyRef, { idField: "id" });
  const playersInGameRef = firestore
    .collection("players")
    .where("inGame", "==", true);
  const [playersInGame] = useCollectionData(playersInGameRef, {
    idField: "id",
  });
  const impostersRef = firestore
    .collection("players")
    .where("role", "==", "imposter");
  const [imposters] = useCollectionData(impostersRef, {
    idField: "id",
  });
  const allLogsRef = firestore.collection("logs");
  const [allLogs] = useCollectionData(allLogsRef, { idField: "id" });
  const currentPlayer: any = allPlayers?.find(
    (player: any) => player.uid === auth.currentUser?.uid
  );
  const currentPlayerIndex = allPlayers?.findIndex(
    (player: any) => player.uid === auth.currentUser?.uid
  );
  const [gameStarting, setGameStarting] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePaused, setGamePaused] = useState(false);
  const [gameResetting, setGameResetting] = useState(false);
  const [screenHidden, setScreenHidden] = useState(false);
  const [screenHiding, setScreenHiding] = useState(false);
  const [crewmatesWin, setCrewmatesWin] = useState(false);
  const [impostersWin, setImpostersWin] = useState(false);
  const [meetingStarting, setMeetingStarting] = useState(false);
  const [meetingStarted, setMeetingStarted] = useState(false);
  const [meetingCooldown, setMeetingCooldown] = useState(Date.now() + 60000);
  const [gameSabotaged, setGameSabotaged] = useState(false);
  const [gameSabotageType, setGameSabotageType] = useState("");
  const [gameSabotageEndsAt, setGameSabotageEndsAt] = useState(
    Date.now() + 2592000000
  );
  const [oxygenFirstDone, setOxygenFirstDone] = useState(false);
  const [oxygenSecondDone, setOxygenSecondDone] = useState(false);
  const [commsDone, setCommsDone] = useState(false);
  const [sabotageCooldownEndsAt, setSabotageCooldownEndsAt] = useState(
    Date.now() + 60000
  );
  const toast = useToast();
  const handleScreenHidden = async () => {
    setScreenHiding(true);
    await allPlayersRef.doc(auth.currentUser?.uid).update({
      screenHidden: true,
    });
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "screenHidden",
    });
    setScreenHidden(true);
  };
  const [isCurrentPlayerAdmin, setIsCurrentPlayerAdmin] = useState(false);
  useEffect(() => {
    if (currentPlayer) {
      setGameStarted(currentPlayer.inGame);
      setMeetingStarting(currentPlayer.isMeetingStarting);
      setMeetingStarted(currentPlayer.isMeetingStarted);
      setGamePaused(currentPlayer.gamePaused);
      setScreenHidden(currentPlayer.screenHidden);
      setIsCurrentPlayerAdmin(currentPlayer.role === "admin" ? true : false);
      setCrewmatesWin(currentPlayer.win === "crewmates");
      setImpostersWin(currentPlayer.win === "imposters");
      setMeetingCooldown(
        currentPlayer.meetingCooldownEndsAt
          ? currentPlayer.meetingCooldownEndsAt - Date.now()
          : Date.now()
      );
      setGameSabotaged(currentPlayer.isSabotaged);
      setGameSabotageType(currentPlayer.sabotageType);
      setGameSabotageEndsAt(
        currentPlayer.sabotageEndsAt
          ? currentPlayer.sabotageEndsAt - Date.now()
          : Date.now()
      );
      setOxygenFirstDone(currentPlayer.isOxygenFirstDone);
      setOxygenSecondDone(currentPlayer.isOxygenSecondDone);
      setCommsDone(currentPlayer.isCommsDone);
      setSabotageCooldownEndsAt(
        currentPlayer.sabotageCooldownEndsAt
          ? currentPlayer.sabotageCooldownEndsAt - Date.now()
          : Date.now()
      );
    } else {
      setGameStarted(false);
      setMeetingStarting(false);
      setMeetingStarted(false);
      setGamePaused(false);
      setScreenHidden(false);
      setIsCurrentPlayerAdmin(false);
      setCrewmatesWin(false);
      setImpostersWin(false);
      setMeetingCooldown(Date.now() + 60000);
      setGameSabotaged(false);
      setGameSabotageType("");
      setGameSabotageEndsAt(Date.now() + 2592000000);
      setOxygenFirstDone(false);
      setOxygenSecondDone(false);
      setCommsDone(false);
      setSabotageCooldownEndsAt(Date.now() + 60000);
    }
  }, [currentPlayer]);
  const [sabotage, setSabotage] = useState("");
  const handleSabotageChange = (event: any) => setSabotage(event.target.value);
  const setWinImposters = useCallback(
    (val) => {
      setImpostersWin(val);
    },
    [setImpostersWin]
  );
  const setWinCrewmates = useCallback(
    (val) => {
      setCrewmatesWin(val);
    },
    [setCrewmatesWin]
  );
  const setMeetStarting = useCallback(
    (val) => {
      setMeetingStarting(val);
    },
    [setMeetingStarting]
  );
  const {
    isOpen: isSabotageOpen,
    onOpen: onSabotageOpen,
    onClose: onSabotageClose,
  } = useDisclosure();
  const {
    isOpen: isResetGameOpen,
    onOpen: onResetGameOpen,
    onClose: onResetGameClose,
  } = useDisclosure();
  const {
    isOpen: isPauseGameOpen,
    onOpen: onPauseGameOpen,
    onClose: onPauseGameClose,
  } = useDisclosure();
  const {
    isOpen: isUnpauseGameOpen,
    onOpen: onUnpauseGameOpen,
    onClose: onUnpauseGameClose,
  } = useDisclosure();
  const {
    isOpen: isResetCrewmatesWinOpen,
    onOpen: onResetCrewmatesWinOpen,
    onClose: onResetCrewmatesWinClose,
  } = useDisclosure();
  const {
    isOpen: isResetImpostersWinOpen,
    onOpen: onResetImpostersWinOpen,
    onClose: onResetImpostersWinClose,
  } = useDisclosure();
  const {
    isOpen: isMeetingStartOpen,
    onOpen: onMeetingStartOpen,
    onClose: onMeetingStartClose,
  } = useDisclosure();
  const {
    isOpen: isMeetingEndOpen,
    onOpen: onMeetingEndOpen,
    onClose: onMeetingEndClose,
  } = useDisclosure();
  const {
    isOpen: isOxygenFirstOpen,
    onOpen: onOxygenFirstOpen,
    onClose: onOxygenFirstClose,
  } = useDisclosure();
  const {
    isOpen: isOxygenSecondOpen,
    onOpen: onOxygenSecondOpen,
    onClose: onOxygenSecondClose,
  } = useDisclosure();
  const {
    isOpen: isCommsOpen,
    onOpen: onCommsOpen,
    onClose: onCommsClose,
  } = useDisclosure();
  const {
    isOpen: isMeetingStartPlayerOpen,
    onOpen: onMeetingStartPlayerOpen,
    onClose: onMeetingStartPlayerClose,
  } = useDisclosure();
  const [impostersCount, setImpostersCount] = useState(0);
  const handleImpostersCountChange = (e: any) =>
    setImpostersCount(e.target.value);
  const [easyTaskCode, setEasyTaskCode] = useState("");
  const [mediumTaskCode, setMediumTaskCode] = useState("");
  const [hardTaskCode, setHardTaskCode] = useState("");
  const [oxygenFirst, setOxygenFirst] = useState("");
  const [oxygenSecond, setOxygenSecond] = useState("");
  const [comms, setComms] = useState("");
  const handleEasyTaskCodeChange = (e: any) => setEasyTaskCode(e.target.value);
  const handleMediumTaskCodeChange = (e: any) =>
    setMediumTaskCode(e.target.value);
  const handleHardTaskCodeChange = (e: any) => setHardTaskCode(e.target.value);
  const handleOxygenFirstChange = (e: any) => setOxygenFirst(e.target.value);
  const handleOxygenSecondChange = (e: any) => setOxygenSecond(e.target.value);
  const handleCommsChange = (e: any) => setComms(e.target.value);
  const [currentTaskId, setCurrentTaskId] = useState(0);
  const {
    isOpen: isEasyTaskCodeOpen,
    onOpen: onEasyTaskCodeOpen,
    onClose: onEasyTaskCodeClose,
  } = useDisclosure();
  const {
    isOpen: isMediumTaskCodeOpen,
    onOpen: onMediumTaskCodeOpen,
    onClose: onMediumTaskCodeClose,
  } = useDisclosure();
  const {
    isOpen: isHardTaskCodeOpen,
    onOpen: onHardTaskCodeOpen,
    onClose: onHardTaskCodeClose,
  } = useDisclosure();
  const {
    isOpen: isRulesOpen,
    onOpen: onRulesOpen,
    onClose: onRulesClose,
  } = useDisclosure();
  const {
    isOpen: isTasksCodesOpen,
    onOpen: onTasksCodesOpen,
    onClose: onTasksCodesClose,
  } = useDisclosure();
  useEffect(() => {
    const interval = setInterval(
      () =>
        setSabotageCooldownEndsAt(
          currentPlayer.sabotageCooldownEndsAt
            ? currentPlayer.sabotageCooldownEndsAt - Date.now()
            : Date.now()
        ),
      1000
    );
    return () => {
      clearInterval(interval);
    };
  }, [sabotageCooldownEndsAt]);
  useEffect(() => {
    const interval = setInterval(
      () =>
        setMeetingCooldown(
          currentPlayer.meetingCooldownEndsAt
            ? currentPlayer.meetingCooldownEndsAt - Date.now()
            : Date.now()
        ),
      1000
    );
    return () => {
      clearInterval(interval);
    };
  }, [meetingCooldown]);
  useEffect(() => {
    const interval = setInterval(async () => {
      if (
        gameSabotaged &&
        gameSabotageType === "oxygen" &&
        gameSabotageEndsAt <= 0
      ) {
        const batch = firestore.batch();
        const allPlayers = await playersRef.get();
        allPlayers.forEach((doc) => {
          batch.update(allPlayersRef.doc(doc.id), {
            win: "imposters",
          });
        });
        await batch.commit();
        setImpostersWin(true);
      }
      setGameSabotageEndsAt(
        currentPlayer.sabotageEndsAt
          ? currentPlayer.sabotageEndsAt - Date.now()
          : Date.now()
      );
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [gameSabotageEndsAt]);
  const allTasksRef = firestore.collection("tasks");
  const [allTasks] = useCollectionData(allTasksRef, {
    idField: "id",
    transform: ({ ...vals }) => ({
      ...vals,
      done: false,
    }),
  });
  if (
    !players ||
    !playersReady ||
    !currentPlayer ||
    !playersInGame ||
    !allPlayers ||
    !allTasks ||
    !allLogs
  ) {
    return <Box>Kraunama...</Box>;
  }
  const checkEasyTaskCode = async (id: number) => {
    if (
      parseInt(easyTaskCode) !==
      currentPlayer.easyTasks.find((task: any) => task.id === id).code
    ) {
      toast({
        title: "Kodas neteisingas",
        description: "Užduotis neužbaigta nes įvestas kodas neteisingas.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } else {
      completeEasyTask(id);
    }
  };
  const checkMediumTaskCode = async (id: number) => {
    if (
      parseInt(mediumTaskCode) !==
      currentPlayer.mediumTasks.find((task: any) => task.id === id).code
    ) {
      toast({
        title: "Kodas neteisingas",
        description: "Užduotis neužbaigta nes įvestas kodas neteisingas.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } else {
      completeMediumTask(id);
    }
  };
  const checkHardTaskCode = async (id: number) => {
    if (
      parseInt(hardTaskCode) !==
      currentPlayer.hardTasks.find((task: any) => task.id === id).code
    ) {
      toast({
        title: "Kodas neteisingas",
        description: "Užduotis neužbaigta nes įvestas kodas neteisingas.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } else {
      completeHardTask(id);
    }
  };
  const checkOxygenFirst = async () => {
    if (parseInt(oxygenFirst) !== currentPlayer.oxygenFirstCode) {
      toast({
        title: "Kodas neteisingas",
        description: "Užduotis neužbaigta nes įvestas kodas neteisingas.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } else {
      completeOxygenFirst();
    }
  };
  const checkOxygenSecond = async () => {
    if (parseInt(oxygenSecond) !== currentPlayer.oxygenSecondCode) {
      toast({
        title: "Kodas neteisingas",
        description: "Užduotis neužbaigta nes įvestas kodas neteisingas.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } else {
      completeOxygenSecond();
    }
  };
  const checkComms = async () => {
    if (parseInt(comms) !== currentPlayer.commsCode) {
      toast({
        title: "Kodas neteisingas",
        description: "Užduotis neužbaigta nes įvestas kodas neteisingas.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } else {
      completeComms();
    }
  };
  const completeEasyTask = async (id: number) => {
    const playerRef = firestore
      .collection("players")
      .doc(auth.currentUser?.uid);
    const tasks = currentPlayer.easyTasks;
    tasks[tasks.findIndex((task: any) => task.id === id)].done = true;
    await playerRef.update({
      easyTasks: tasks,
      doneTasks: currentPlayer.doneTasks + 1,
    });
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "completeEasyTask?id=" + id,
    });
    onEasyTaskCodeClose();
    setEasyTaskCode("");
    if (
      (doneTasks() / ((players.length - 3 - currentPlayer.imposters) * 10)) *
        100 ===
      100
    ) {
      const batch = firestore.batch();
      const allPlayers = await playersRef.get();
      allPlayers.forEach((doc) => {
        batch.update(allPlayersRef.doc(doc.id), {
          win: "crewmates",
        });
      });
      await batch.commit();
      setCrewmatesWin(true);
    }
  };
  const completeMediumTask = async (id: number) => {
    const playerRef = firestore
      .collection("players")
      .doc(auth.currentUser?.uid);
    const tasks = currentPlayer.mediumTasks;
    tasks[tasks.findIndex((task: any) => task.id === id)].done = true;
    await playerRef.update({
      mediumTasks: tasks,
      doneTasks: currentPlayer.doneTasks + 1,
    });
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "completeMediumTask?id=" + id,
    });
    onMediumTaskCodeClose();
    setMediumTaskCode("");
    if (
      (doneTasks() / ((players.length - 3 - currentPlayer.imposters) * 10)) *
        100 ===
      100
    ) {
      const batch = firestore.batch();
      const allPlayers = await playersRef.get();
      allPlayers.forEach((doc) => {
        batch.update(allPlayersRef.doc(doc.id), {
          win: "crewmates",
        });
      });
      await batch.commit();
      setCrewmatesWin(true);
    }
  };
  const completeHardTask = async (id: number) => {
    const playerRef = firestore
      .collection("players")
      .doc(auth.currentUser?.uid);
    const tasks = currentPlayer.hardTasks;
    tasks[tasks.findIndex((task: any) => task.id === id)].done = true;
    await playerRef.update({
      hardTasks: tasks,
      doneTasks: currentPlayer.doneTasks + 1,
    });
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "completeHardTask?id=" + id,
    });
    onHardTaskCodeClose();
    setHardTaskCode("");
    if (
      (doneTasks() / ((players.length - 3 - currentPlayer.imposters) * 10)) *
        100 ===
      100
    ) {
      const batch = firestore.batch();
      const allPlayers = await playersRef.get();
      allPlayers.forEach((doc) => {
        batch.update(allPlayersRef.doc(doc.id), {
          win: "crewmates",
        });
      });
      await batch.commit();
      setCrewmatesWin(true);
    }
  };
  const completeOxygenFirst = async () => {
    const batch = firestore.batch();
    const allPlayers = await playersRef.get();
    allPlayers.forEach((doc) => {
      batch.update(allPlayersRef.doc(doc.id), {
        isOxygenFirstDone: true,
      });
    });
    await batch.commit();
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "completeOxygenFirst",
    });
    setOxygenFirstDone(true);
    onOxygenFirstClose();
    setOxygenFirst("");
    if (currentPlayer?.isOxygenSecondDone) {
      const secondBatch = firestore.batch();
      allPlayers.forEach((doc) => {
        secondBatch.update(allPlayersRef.doc(doc.id), {
          isSabotaged: false,
          sabotageType: "",
          sabotageEndsAt: Date.now() + 2592000000,
          sabotageCooldownEndsAt: Date.now() + 180000,
        });
      });
      await secondBatch.commit();
      const logsRef = firestore
        .collection("logs")
        .doc(new Date().toISOString());
      await logsRef.set({
        name: auth.currentUser?.displayName,
        uid: auth.currentUser?.uid,
        action: "completeOxygen",
      });
      setGameSabotaged(false);
      setGameSabotageType("");
      setGameSabotageEndsAt(Date.now() + 2592000000);
      setSabotageCooldownEndsAt(Date.now() + 180000);
    }
  };
  const completeOxygenSecond = async () => {
    const batch = firestore.batch();
    const allPlayers = await playersRef.get();
    allPlayers.forEach((doc) => {
      batch.update(allPlayersRef.doc(doc.id), {
        isOxygenSecondDone: true,
      });
    });
    await batch.commit();
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "completeOxygenSecond",
    });
    setOxygenSecondDone(true);
    onOxygenSecondClose();
    setOxygenSecond("");
    if (currentPlayer?.isOxygenFirstDone) {
      const secondBatch = firestore.batch();
      allPlayers.forEach((doc) => {
        secondBatch.update(allPlayersRef.doc(doc.id), {
          isSabotaged: false,
          sabotageType: "",
          sabotageEndsAt: Date.now() + 2592000000,
          sabotageCooldownEndsAt: Date.now() + 180000,
        });
      });
      await secondBatch.commit();
      const logsRef = firestore
        .collection("logs")
        .doc(new Date().toISOString());
      await logsRef.set({
        name: auth.currentUser?.displayName,
        uid: auth.currentUser?.uid,
        action: "completeOxygen",
      });
      setGameSabotaged(false);
      setGameSabotageType("");
      setGameSabotageEndsAt(Date.now() + 2592000000);
      setSabotageCooldownEndsAt(Date.now() + 180000);
    }
  };
  const completeComms = async () => {
    const batch = firestore.batch();
    const allPlayers = await playersRef.get();
    allPlayers.forEach((doc) => {
      batch.update(allPlayersRef.doc(doc.id), {
        isCommsDone: true,
        isSabotaged: false,
        sabotageType: "",
        sabotageEndsAt: Date.now() + 2592000000,
        sabotageCooldownEndsAt: Date.now() + 180000,
      });
    });
    await batch.commit();
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "completeComms",
    });
    setCommsDone(true);
    onCommsClose();
    setComms("");
    setGameSabotaged(false);
    setGameSabotageType("");
    setGameSabotageEndsAt(Date.now() + 2592000000);
    setSabotageCooldownEndsAt(Date.now() + 180000);
  };
  const doneTasks = () => {
    var done = 0;
    playersInGame.forEach((player: any) => {
      player.easyTasks.forEach((task: any) => {
        if (task.done) done++;
      });
      player.mediumTasks.forEach((task: any) => {
        if (task.done) done += 2;
      });
      player.hardTasks.forEach((task: any) => {
        if (task.done) done += 3;
      });
    });
    return done;
  };
  const allTasksSorted = allTasks.sort((a, b) => a.id - b.id);
  const startGame = async () => {
    if (playersReady?.length < players?.length) {
      toast({
        title: "Žaidimas nepradėtas",
        description:
          "Žaidimas negali būti pradėtas nes ne visi žaidėjai yra pasiruošę.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } else if (impostersCount === 0) {
      toast({
        title: "Žaidimas nepradėtas",
        description:
          "Žaidimas negali būti pradėtas nes nenustatytas apsimetėlių skaičius.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } else {
      const batch = firestore.batch();
      setGameStarting(true);
      const easyTasks = allTasksSorted.slice(0, 24);
      const mediumTasks = allTasksSorted.slice(24, 40);
      const hardTasks = allTasksSorted.slice(40, 48);
      const easyTasks2 = allTasksSorted.slice(0, 24);
      const mediumTasks2 = allTasksSorted.slice(24, 40);
      const hardTasks2 = allTasksSorted.slice(40, 48);
      const easyTasks3 = allTasksSorted.slice(0, 24);
      const mediumTasks3 = allTasksSorted.slice(24, 40);
      const hardTasks3 = allTasksSorted.slice(40, 48);
      const easyTasks4 = allTasksSorted.slice(0, 24);
      const mediumTasks4 = allTasksSorted.slice(24, 40);
      const hardTasks4 = allTasksSorted.slice(40, 48);
      const shuffledEasyTasks1 = easyTasks.sort(() => 0.5 - Math.random());
      const shuffledMediumTasks1 = mediumTasks.sort(() => 0.5 - Math.random());
      const shuffledHardTasks1 = hardTasks.sort(() => 0.5 - Math.random());
      const shuffledEasyTasks2 = easyTasks2.sort(() => 0.5 - Math.random());
      const shuffledMediumTasks2 = mediumTasks2.sort(() => 0.5 - Math.random());
      const shuffledHardTasks2 = hardTasks2.sort(() => 0.5 - Math.random());
      const shuffledEasyTasks3 = easyTasks3.sort(() => 0.5 - Math.random());
      const shuffledMediumTasks3 = mediumTasks3.sort(() => 0.5 - Math.random());
      const shuffledHardTasks3 = hardTasks3.sort(() => 0.5 - Math.random());
      const shuffledEasyTasks4 = easyTasks4.sort(() => 0.5 - Math.random());
      const shuffledMediumTasks4 = mediumTasks4.sort(() => 0.5 - Math.random());
      const shuffledHardTasks4 = hardTasks4.sort(() => 0.5 - Math.random());
      var tasksLeft1 = 8;
      var tasksLeft2 = 8;
      var tasksLeft3 = 8;
      const allPlayers = await playersRef
        .orderBy("role")
        .orderBy("random")
        .get();
      var imposters = impostersCount;
      allPlayers.forEach((doc) => {
        if (tasksLeft1 > 0) {
          batch.update(allPlayersRef.doc(doc.id), {
            inGame: doc.data().ready,
            imposters: impostersCount,
            isDead: false,
            killedBy: "",
            reportedBy: "",
            isReported: false,
            isMeetingStarting: false,
            isMeetingStarted: false,
            meetingCooldownEndsAt: Date.now() + 60000,
            isSabotaged: false,
            sabotageType: "",
            sabotageEndsAt: Date.now(),
            isOxygenFirstDone: false,
            isOxygenSecondDone: false,
            isCommsDone: false,
            oxygenFirstCode: 661084,
            oxygenSecondCode: 604902,
            commsCode: 824411,
            sabotageCooldownEndsAt: Date.now() + 60000,
            screenHidden: false,
            win: "",
            gamePaused: false,
            role:
              doc.data().role === "admin"
                ? "admin"
                : imposters > 0
                ? "imposter"
                : "crewmate",
            easyTasks: shuffledEasyTasks1.slice(0, 3),
            mediumTasks: shuffledMediumTasks1.slice(0, 2),
            hardTasks: shuffledHardTasks1.slice(0, 1),
            doneTasks: 0,
            cooldownEndsAt: Date.now() + 180000,
          });
        } else if (tasksLeft2 > 0) {
          batch.update(allPlayersRef.doc(doc.id), {
            inGame: doc.data().ready,
            imposters: impostersCount,
            isDead: false,
            killedBy: "",
            reportedBy: "",
            isReported: false,
            isMeetingStarting: false,
            isMeetingStarted: false,
            meetingCooldownEndsAt: Date.now() + 60000,
            isSabotaged: false,
            sabotageType: "",
            sabotageEndsAt: Date.now(),
            isOxygenFirstDone: false,
            isOxygenSecondDone: false,
            isCommsDone: false,
            oxygenFirstCode: 661084,
            oxygenSecondCode: 604902,
            commsCode: 824411,
            sabotageCooldownEndsAt: Date.now() + 60000,
            screenHidden: false,
            win: "",
            gamePaused: false,
            role:
              doc.data().role === "admin"
                ? "admin"
                : imposters > 0
                ? "imposter"
                : "crewmate",
            easyTasks: shuffledEasyTasks2.slice(0, 3),
            mediumTasks: shuffledMediumTasks2.slice(0, 2),
            hardTasks: shuffledHardTasks2.slice(0, 1),
            doneTasks: 0,
            cooldownEndsAt: Date.now() + 180000,
          });
        } else if (tasksLeft3 > 0) {
          batch.update(allPlayersRef.doc(doc.id), {
            inGame: doc.data().ready,
            imposters: impostersCount,
            isDead: false,
            killedBy: "",
            reportedBy: "",
            isReported: false,
            isMeetingStarting: false,
            isMeetingStarted: false,
            meetingCooldownEndsAt: Date.now() + 60000,
            isSabotaged: false,
            sabotageType: "",
            sabotageEndsAt: Date.now(),
            isOxygenFirstDone: false,
            isOxygenSecondDone: false,
            isCommsDone: false,
            oxygenFirstCode: 661084,
            oxygenSecondCode: 604902,
            commsCode: 824411,
            sabotageCooldownEndsAt: Date.now() + 60000,
            screenHidden: false,
            win: "",
            gamePaused: false,
            role:
              doc.data().role === "admin"
                ? "admin"
                : imposters > 0
                ? "imposter"
                : "crewmate",
            easyTasks: shuffledEasyTasks3.slice(0, 3),
            mediumTasks: shuffledMediumTasks3.slice(0, 2),
            hardTasks: shuffledHardTasks3.slice(0, 1),
            doneTasks: 0,
            cooldownEndsAt: Date.now() + 180000,
          });
        } else {
          batch.update(allPlayersRef.doc(doc.id), {
            inGame: doc.data().ready,
            imposters: impostersCount,
            isDead: false,
            killedBy: "",
            reportedBy: "",
            isReported: false,
            isMeetingStarting: false,
            isMeetingStarted: false,
            meetingCooldownEndsAt: Date.now() + 60000,
            isSabotaged: false,
            sabotageType: "",
            sabotageEndsAt: Date.now(),
            isOxygenFirstDone: false,
            isOxygenSecondDone: false,
            isCommsDone: false,
            oxygenFirstCode: 661084,
            oxygenSecondCode: 604902,
            commsCode: 824411,
            sabotageCooldownEndsAt: Date.now() + 60000,
            screenHidden: false,
            win: "",
            gamePaused: false,
            role:
              doc.data().role === "admin"
                ? "admin"
                : imposters > 0
                ? "imposter"
                : "crewmate",
            easyTasks: shuffledEasyTasks4.slice(0, 3),
            mediumTasks: shuffledMediumTasks4.slice(0, 2),
            hardTasks: shuffledHardTasks4.slice(0, 1),
            doneTasks: 0,
            cooldownEndsAt: Date.now() + 180000,
          });
        }
        if (tasksLeft1 > 0) {
          shuffledEasyTasks1.splice(0, 3);
          shuffledMediumTasks1.splice(0, 2);
          shuffledHardTasks1.splice(0, 1);
          tasksLeft1--;
        } else if (tasksLeft2 > 0) {
          shuffledEasyTasks2.splice(0, 3);
          shuffledMediumTasks2.splice(0, 2);
          shuffledHardTasks2.splice(0, 1);
          tasksLeft2--;
        } else if (tasksLeft3 > 0) {
          shuffledEasyTasks3.splice(0, 3);
          shuffledMediumTasks3.splice(0, 2);
          shuffledHardTasks3.splice(0, 1);
          tasksLeft3--;
        }
        if (doc.data().role !== "admin" && doc.data().role !== "dq")
          imposters--;
      });
      await batch.commit();
      const logsRef = firestore
        .collection("logs")
        .doc(new Date().toISOString());
      await logsRef.set({
        name: auth.currentUser?.displayName,
        uid: auth.currentUser?.uid,
        action: "startGame",
      });
      setGameStarted(true);
    }
  };
  const resetGame = async () => {
    const batch = firestore.batch();
    setGameResetting(true);
    const allPlayers = await playersRef.get();
    allPlayers.forEach((doc) => {
      batch.update(allPlayersRef.doc(doc.id), {
        inGame: false,
        isDead: false,
        ready: false,
        killedBy: "",
        isReported: false,
        screenHidden: false,
        win: "",
        gamePaused: false,
        role: doc.data().role === "admin" ? "admin" : "player",
        easyTasks: firebase.firestore.FieldValue.delete(),
        mediumTasks: firebase.firestore.FieldValue.delete(),
        hardTasks: firebase.firestore.FieldValue.delete(),
        doneTasks: 0,
        cooldownEndsAt: firebase.firestore.FieldValue.delete(),
        imposters: 0,
        reportedBy: "",
        isMeetingStarting: false,
        isMeetingStarted: false,
        meetingCooldownEndsAt: Date.now() + 60000,
        isSabotaged: false,
        sabotageType: "",
        sabotageEndsAt: Date.now(),
        isOxygenFirstDone: false,
        isOxygenSecondDone: false,
        isCommsDone: false,
        oxygenFirstCode: 661084,
        oxygenSecondCode: 604902,
        commsCode: 824411,
        sabotageCooldownEndsAt: Date.now() + 60000,
        random: Math.floor(Math.random() * 999999 + 1),
      });
    });
    await batch.commit();
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "resetGame",
    });
    setGameStarted(false);
    setGameResetting(false);
    setGameStarting(false);
    setScreenHiding(false);
  };
  const pauseGame = async () => {
    const batch = firestore.batch();
    const allPlayers = await playersRef.get();
    allPlayers.forEach((doc) => {
      batch.update(allPlayersRef.doc(doc.id), {
        gamePaused: true,
      });
    });
    await batch.commit();
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "pauseGame",
    });
    setGamePaused(true);
  };
  const unpauseGame = async () => {
    const batch = firestore.batch();
    const allPlayers = await playersRef.get();
    allPlayers.forEach((doc) => {
      batch.update(allPlayersRef.doc(doc.id), {
        gamePaused: false,
      });
    });
    await batch.commit();
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "unpauseGame",
    });
    setGamePaused(false);
  };
  const undoWin = async () => {
    const batch = firestore.batch();
    const allPlayers = await playersRef.get();
    allPlayers.forEach((doc) => {
      batch.update(allPlayersRef.doc(doc.id), {
        gamePaused: true,
        win: "",
      });
    });
    await batch.commit();
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "undoWin",
    });
    setGamePaused(true);
  };
  const startMeetingStarting = async () => {
    if (currentPlayer.isSabotaged) {
      toast({
        title: "Susirinkimas nepradėtas",
        description:
          "Susirinkimas negali būti pradėtas nes šiuo metu vyksta sabotažas.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } else {
      const deadCrewmatesRef = firestore
        .collection("players")
        .where("role", "==", "crewmate")
        .where("isDead", "==", true)
        .where("isReported", "==", false);
      const deadCrewmates = await deadCrewmatesRef.get();
      const deadCrewmatesBatch = firestore.batch();
      deadCrewmates.forEach((doc) => {
        deadCrewmatesBatch.update(allPlayersRef.doc(doc.id), {
          isReported: true,
        });
      });
      await deadCrewmatesBatch.commit();
      const batch = firestore.batch();
      const allPlayers = await playersRef.get();
      allPlayers.forEach((doc) => {
        batch.update(allPlayersRef.doc(doc.id), {
          isMeetingStarting: true,
        });
      });
      await batch.commit();
      const logsRef = firestore
        .collection("logs")
        .doc(new Date().toISOString());
      await logsRef.set({
        name: auth.currentUser?.displayName,
        uid: auth.currentUser?.uid,
        action: "startMeetingStarting",
      });
      setMeetingStarting(true);
    }
  };
  const startMeeting = async () => {
    const batch = firestore.batch();
    const allPlayers = await playersRef.get();
    allPlayers.forEach((doc) => {
      batch.update(allPlayersRef.doc(doc.id), {
        isMeetingStarting: false,
        isMeetingStarted: true,
      });
    });
    await batch.commit();
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "startMeeting",
    });
    setMeetingStarting(false);
    setMeetingStarted(true);
  };
  const endMeeting = async () => {
    const batch = firestore.batch();
    const allPlayers = await playersRef.get();
    allPlayers.forEach((doc) => {
      batch.update(allPlayersRef.doc(doc.id), {
        isMeetingStarted: false,
        meetingCooldownEndsAt: Date.now() + 30000,
        cooldownEndsAt: Date.now() + 45000,
        sabotageCooldownEndsAt: Date.now() + 10000,
      });
    });
    await batch.commit();
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "endMeeting",
    });
    setMeetingStarting(false);
    setMeetingStarted(false);
    setMeetingCooldown(Date.now() + 120000);
  };
  const startSabotage = async (type: string) => {
    if (currentPlayer?.isSabotaged) {
      toast({
        title: "Sabotažas nepradėtas",
        description:
          "Sabotažas negali būti pradėtas nes kitas sabotažas jau buvo pradėtas.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } else {
      const batch = firestore.batch();
      const allPlayers = await playersRef.get();
      allPlayers.forEach((doc) => {
        batch.update(allPlayersRef.doc(doc.id), {
          isSabotaged: true,
          sabotageType: type,
          sabotageEndsAt: type === "oxygen" ? Date.now() + 90000 : Date.now(),
          sabotageCooldownEndsAt: Date.now() + 180000,
          isCommsDone: false,
          isOxygenFirstDone: false,
          isOxygenSecondDone: false,
        });
      });
      await batch.commit();
      const logsRef = firestore
        .collection("logs")
        .doc(new Date().toISOString());
      await logsRef.set({
        name: auth.currentUser?.displayName,
        uid: auth.currentUser?.uid,
        action: "startSabotage?type=" + type,
      });
      setGameSabotaged(true);
      setGameSabotageType(type);
      setGameSabotageEndsAt(
        type === "oxygen" ? Date.now() + 90000 : Date.now()
      );
      setSabotageCooldownEndsAt(Date.now() + 180000);
    }
  };
  return (
    <>
      {currentPlayer.role === "dq" ? (
        <Flex
          px={3}
          alignItems="center"
          justifyContent="center"
          width="100vw"
          height="100vh"
          direction="column"
        >
          <Text mt={4} fontSize="20px" textAlign="center" color="red.600">
            Jūs buvote diskvalifikuotas
          </Text>
        </Flex>
      ) : !gameStarted ? (
        <Box px={3}>
          <Text fontWeight="600" fontSize="30px" mb={4}>
            Žaidėjai ({playersReady?.length} / {players.length})
          </Text>
          <Player info={currentPlayer} isAdmin={isCurrentPlayerAdmin} />
          {allPlayers &&
            allPlayers.map((player: any, index: number) => {
              if (currentPlayerIndex !== index)
                return (
                  <Player
                    key={player.id}
                    info={player}
                    isAdmin={isCurrentPlayerAdmin}
                  />
                );
            })}
          {isCurrentPlayerAdmin && (
            <>
              <Text mb={1} mt={6}>
                Apsimetėlių skaičius:
              </Text>
              <Input
                type="number"
                value={impostersCount}
                onChange={handleImpostersCountChange}
              />
              <Button
                mt={4}
                colorScheme="blue"
                isLoading={gameStarting}
                onClick={startGame}
                width="100%"
              >
                Pradėti žaidimą
              </Button>
            </>
          )}
        </Box>
      ) : !screenHidden ? (
        <Flex
          px={3}
          alignItems="center"
          justifyContent="center"
          width="100vw"
          height="100vh"
          direction="column"
        >
          <Text mt={4} fontSize="20px" textAlign="center" color="red.600">
            Paslėpkite savo ekraną nuo kitų, kad kiti nežinotų kokią rolę gavote
          </Text>
          <Button
            mt={3}
            onClick={handleScreenHidden}
            isLoading={screenHiding}
            colorScheme="blue"
          >
            Paslėpiau
          </Button>
        </Flex>
      ) : gamePaused ? (
        <Flex
          px={3}
          alignItems="center"
          justifyContent="center"
          width="100vw"
          height="100vh"
          direction="column"
        >
          <Text mt={4} fontSize="20px" textAlign="center" color="red.600">
            Žaidimas pristabdytas, iki kol bus išspręsta problema
          </Text>
          {isCurrentPlayerAdmin && (
            <>
              <Button mt={3} onClick={onUnpauseGameOpen} colorScheme="blue">
                Pratęsti žaidimą
              </Button>
              <Modal isOpen={isUnpauseGameOpen} onClose={onUnpauseGameClose}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Pratęsti žaidimą</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>Ar tikrai norite pratęsti žaidimą?</ModalBody>
                  <ModalFooter>
                    <Button colorScheme="green" mr={3} onClick={unpauseGame}>
                      Patvirtinti
                    </Button>
                    <Button variant="ghost" onClick={onUnpauseGameClose}>
                      Atšaukti
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </>
          )}
        </Flex>
      ) : meetingStarting ? (
        <Flex
          px={3}
          alignItems="center"
          justifyContent="center"
          width="100vw"
          height="100vh"
          direction="column"
        >
          <Text mt={4} fontSize="20px" textAlign="center" color="red.600">
            Prasideda susirinkimas! <br />
            Visi renkamės pagrindinėje salėje prie stalo.
          </Text>
          {isCurrentPlayerAdmin && (
            <>
              <Button mt={3} onClick={onMeetingStartOpen} colorScheme="blue">
                Pradėti susirinkimą
              </Button>
              <Modal isOpen={isMeetingStartOpen} onClose={onMeetingStartClose}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Pradėti susirinkimą</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>
                    Ar tikrai susirinko visi žaidėjai ir norite pradėti
                    susirinkimą?
                  </ModalBody>
                  <ModalFooter>
                    <Button colorScheme="green" mr={3} onClick={startMeeting}>
                      Patvirtinti
                    </Button>
                    <Button variant="ghost" onClick={onMeetingStartClose}>
                      Atšaukti
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </>
          )}
        </Flex>
      ) : meetingStarted ? (
        <Flex
          px={3}
          justifyContent="center"
          width="100vw"
          height="100vh"
          direction="column"
        >
          <Text mt={4} fontSize="20px" textAlign="center" color="red.600">
            Vyksta susirinkimas
          </Text>
          <Text fontWeight="600" fontSize="30px" mt={6} mb={2}>
            Žaidėjai:
          </Text>
          {playersInGame &&
            playersInGame.map((player: any, index: number) => {
              if (currentPlayerIndex !== index)
                if (player.role !== "admin")
                  return (
                    <PlayerInGameInMeeting
                      key={player.id}
                      info={player}
                      setWinImposters={setWinImposters}
                      setWinCrewmates={setWinCrewmates}
                      isAdmin={isCurrentPlayerAdmin}
                    />
                  );
            })}
          {isCurrentPlayerAdmin && (
            <>
              <Button mt={3} onClick={onMeetingEndOpen} colorScheme="blue">
                Užbaigti susirinkimą
              </Button>
              <Modal isOpen={isMeetingEndOpen} onClose={onMeetingEndClose}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Užbaigti susirinkimą</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>Ar tikrai norite užbaigti susirinkimą?</ModalBody>
                  <ModalFooter>
                    <Button colorScheme="green" mr={3} onClick={endMeeting}>
                      Patvirtinti
                    </Button>
                    <Button variant="ghost" onClick={onMeetingEndClose}>
                      Atšaukti
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </>
          )}
        </Flex>
      ) : crewmatesWin ? (
        <Flex
          px={3}
          width="100vw"
          height="100vh"
          backgroundColor="blue.600"
          alignItems="center"
          justifyContent="center"
          direction="column"
        >
          <Text
            color="white"
            fontWeight="600"
            fontSize="40px"
            textTransform="uppercase"
            textAlign="center"
          >
            Įgula laimėjo
          </Text>
          <Text
            color="red.900"
            fontWeight="600"
            fontSize="20px"
            textAlign="center"
          >
            Apsimetėliais buvo:
          </Text>
          {imposters?.map((imposter: any) => (
            <Text color="red.900" fontSize="30px" textAlign="center">
              {imposter.name}
            </Text>
          ))}
          {isCurrentPlayerAdmin && (
            <>
              <Button
                mt={4}
                colorScheme="gray"
                onClick={onResetCrewmatesWinOpen}
                width="100%"
              >
                Anuliuoti įgulos laimėjimą
              </Button>
              <Modal
                isOpen={isResetCrewmatesWinOpen}
                onClose={onResetCrewmatesWinClose}
              >
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Anuliuoti laimėjimą</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>
                    Ar tikrai norite anuliuoti įgulos laimėjimą?
                  </ModalBody>

                  <ModalFooter>
                    <Button colorScheme="blue" mr={3} onClick={undoWin}>
                      Patvirtinti
                    </Button>
                    <Button variant="ghost" onClick={onResetCrewmatesWinClose}>
                      Atšaukti
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
              <Button
                mt={4}
                colorScheme="gray"
                isLoading={gameResetting}
                onClick={onResetGameOpen}
                width="100%"
              >
                Pradėti žaidimą iš naujo
              </Button>
              <Modal isOpen={isResetGameOpen} onClose={onResetGameClose}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Pradėti žaidimą iš naujo</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>
                    Ar tikrai norite pradėti žaidimą iš naujo?
                  </ModalBody>
                  <ModalFooter>
                    <Button colorScheme="green" mr={3} onClick={resetGame}>
                      Patvirtinti
                    </Button>
                    <Button variant="ghost" onClick={onResetGameClose}>
                      Atšaukti
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </>
          )}
        </Flex>
      ) : impostersWin ? (
        <Flex
          px={3}
          width="100vw"
          height="100vh"
          backgroundColor="red.600"
          alignItems="center"
          justifyContent="center"
          direction="column"
        >
          <Text
            color="white"
            fontWeight="600"
            fontSize="40px"
            textTransform="uppercase"
            textAlign="center"
          >
            Apsimetėliai laimėjo
          </Text>
          <Text
            color="white"
            fontWeight="600"
            fontSize="20px"
            textAlign="center"
          >
            Apsimetėliais buvo:
          </Text>
          {imposters?.map((imposter: any) => (
            <Text color="white" fontSize="30px" textAlign="center">
              {imposter.name}
            </Text>
          ))}
          {isCurrentPlayerAdmin && (
            <>
              <Button
                mt={4}
                colorScheme="gray"
                onClick={onResetImpostersWinOpen}
                width="100%"
              >
                Anuliuoti apsimetėlių laimėjimą
              </Button>
              <Modal
                isOpen={isResetImpostersWinOpen}
                onClose={onResetImpostersWinClose}
              >
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Anuliuoti laimėjimą</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>
                    Ar tikrai norite anuliuoti apsimetėlių laimėjimą?
                  </ModalBody>

                  <ModalFooter>
                    <Button colorScheme="blue" mr={3} onClick={undoWin}>
                      Patvirtinti
                    </Button>
                    <Button variant="ghost" onClick={onResetImpostersWinClose}>
                      Atšaukti
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
              <Button
                mt={4}
                colorScheme="gray"
                isLoading={gameResetting}
                onClick={onResetGameOpen}
                width="100%"
              >
                Pradėti žaidimą iš naujo
              </Button>
              <Modal isOpen={isResetGameOpen} onClose={onResetGameClose}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Pradėti žaidimą iš naujo</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>
                    Ar tikrai norite pradėti žaidimą iš naujo?
                  </ModalBody>
                  <ModalFooter>
                    <Button colorScheme="green" mr={3} onClick={resetGame}>
                      Patvirtinti
                    </Button>
                    <Button variant="ghost" onClick={onResetGameClose}>
                      Atšaukti
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </>
          )}
        </Flex>
      ) : (
        <Box px={3}>
          <Flex justifyContent="space-between">
            <Text fontSize="18px" mt={3}>
              Jūs esate{" "}
              {currentPlayer.role === "admin" ? (
                <Text color="green.600" display="inline" fontWeight="600">
                  administratorius
                </Text>
              ) : currentPlayer.role === "crewmate" ? (
                <Text color="blue.600" display="inline" fontWeight="600">
                  įgulos narys
                </Text>
              ) : (
                <Text color="red.600" display="inline" fontWeight="600">
                  apsimetėlis
                </Text>
              )}
            </Text>
            <Text fontSize="16px" mt={3} onClick={onRulesOpen}>
              {currentPlayer.role === "admin" ? (
                <Text color="green.600" display="inline" fontWeight="600">
                  Taisyklės
                </Text>
              ) : currentPlayer.role === "crewmate" ? (
                <Text color="blue.600" display="inline" fontWeight="600">
                  Taisyklės
                </Text>
              ) : (
                <Text color="red.600" display="inline" fontWeight="600">
                  Taisyklės
                </Text>
              )}
              <Modal isOpen={isRulesOpen} onClose={onRulesClose}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Taisyklės</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>
                    <OrderedList>
                      <ListItem>Draudžiama bėgioti</ListItem>
                      <ListItem>
                        Draudžiama šnekėti ne susirinkimo metu
                      </ListItem>
                      <ListItem>
                        Draudžiama atskleisti savo ir kitų žaidėjų roles
                      </ListItem>
                      <ListItem>
                        Draudžiama atskleisti ar esi miręs ar gyvas
                      </ListItem>
                      <ListItem>Draudžiama atskleisti kas tave nužudė</ListItem>
                      <ListItem>
                        Draudžiama bet kokiu būdu prašyti kitų žaidėjų
                        atskleisti savo rolę
                      </ListItem>
                      <ListItem>
                        Draudžiama dalintis užduočių kodais su kitais žaidėjais
                      </ListItem>
                      <ListItem>
                        Draudžiama tikrinti žmonių asmeninius daiktus
                      </ListItem>
                      <ListItem>
                        Draudžiama nužudyti žaidėją programėleje to nepadarius
                        fiziškai
                      </ListItem>
                      <ListItem>
                        Privaloma daryti užduotis net ir mirus
                      </ListItem>
                      <ListItem>
                        Įėjus ar išėjus į/iš patalpą su durim, privaloma jas
                        uždaryti
                      </ListItem>
                      <ListItem>
                        Privaloma grąžinti visus daiktus į jų pradines vietas
                        arba atiduoti daiktus moderatoriams
                      </ListItem>
                      <ListItem>
                        Mirus privaloma palikti šviečiančią lazdelę mirties
                        vietoje
                      </ListItem>
                    </OrderedList>
                  </ModalBody>
                  <ModalFooter>
                    <Button variant="ghost" onClick={onRulesClose}>
                      Grįžti
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </Text>
          </Flex>
          <Text mb={2} fontSize="30px" fontWeight="600">
            Atlikta užduočių:
          </Text>
          <Progress
            colorScheme={
              currentPlayer.role === "crewmate" ||
              currentPlayer.role === "admin"
                ? "green"
                : "red"
            }
            size="md"
            value={
              (doneTasks() /
                ((players.length - 3 - currentPlayer.imposters) * 10)) *
              100
            }
            borderRadius="5px"
            mb={2}
          />
          {currentPlayer.role === "crewmate" && !currentPlayer.isDead ? (
            <>
              <Button
                colorScheme="blue"
                width="100%"
                my={3}
                onClick={onMeetingStartPlayerOpen}
                disabled={meetingCooldown > 0 || gameSabotaged}
                _focus={{ boxShadow: "none" }}
              >
                {meetingCooldown > 0
                  ? moment(meetingCooldown - 3 * 60 * 60 * 1000).format("mm:ss")
                  : "Šaukti susirinkimą"}
              </Button>
              <Modal
                isOpen={isMeetingStartPlayerOpen}
                onClose={onMeetingStartPlayerClose}
              >
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Šaukti susirinkimą</ModalHeader>
                  <ModalCloseButton _focus={{ boxShadow: "none" }} />
                  <ModalBody>
                    Ar tikrai norite sušaukti visų žaidėjų susirinkimą
                    pagrindinėje salėje?
                  </ModalBody>
                  <ModalFooter>
                    <Button
                      colorScheme="red"
                      mr={3}
                      _focus={{ boxShadow: "none" }}
                      onClick={() => {
                        startMeetingStarting();
                        onMeetingStartPlayerClose();
                      }}
                    >
                      Pradėti
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={onMeetingStartPlayerClose}
                      _focus={{ boxShadow: "none" }}
                    >
                      Atšaukti
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </>
          ) : currentPlayer.role === "imposter" ? (
            <>
              <Button
                colorScheme="red"
                width="100%"
                my={3}
                onClick={onSabotageOpen}
                disabled={sabotageCooldownEndsAt > 0}
                _focus={{ boxShadow: "none" }}
              >
                {sabotageCooldownEndsAt > 0
                  ? moment(sabotageCooldownEndsAt - 3 * 60 * 60 * 1000).format(
                      "mm:ss"
                    )
                  : "Sabotažas"}
              </Button>
              <Modal isOpen={isSabotageOpen} onClose={onSabotageClose}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Sabotažas</ModalHeader>
                  <ModalCloseButton _focus={{ boxShadow: "none" }} />
                  <ModalBody>
                    <Text color="red.600" fontSize="20px" fontWeight="600">
                      Komunikacijos:
                    </Text>
                    <Text>
                      Įgulos nariai nebemato savo užduočių, kurias reikia
                      atlikti ir negali jų atlikti, kol nesuveda vienoje vietoje
                      esančio kodo. Taip pat įgulos nariai nebegali šaukti
                      susirinkimo, bet vis tiek gali pranešti apie rastą mirusį
                      įgulos narį.
                    </Text>
                    <Text
                      color="red.600"
                      fontSize="20px"
                      fontWeight="600"
                      mt={3}
                    >
                      Deguonis:
                    </Text>
                    <Text>
                      Įgulos nariai per 90 sekundžių turi suvesti 2 kodus, kurie
                      yra skirtingose vietose. Jei įgulos nariai nespėja suvesti
                      kodų - apsimetėliai laimi. Taip pat įgulos nariai nebegali
                      šaukti susirinkimo, bet vis tiek gali pranešti apie rastą
                      mirusį įgulos narį.
                    </Text>
                    <Select
                      placeholder="Pasirinkite sabotažą"
                      mt={3}
                      onChange={handleSabotageChange}
                    >
                      <option value="comms">Komunikacijos</option>
                      <option value="oxygen">Deguonis</option>
                    </Select>
                  </ModalBody>
                  <ModalFooter>
                    <Button
                      colorScheme="red"
                      mr={3}
                      _focus={{ boxShadow: "none" }}
                      onClick={() => {
                        if (
                          sabotage === undefined ||
                          sabotage === null ||
                          sabotage.length === 0
                        ) {
                          toast({
                            title: "Sabotažas nepradėtas",
                            description:
                              "Pasirinkite, kurį sabotažą norite pradėti",
                            status: "error",
                            duration: 3000,
                            isClosable: true,
                          });
                        } else {
                          startSabotage(sabotage);
                          onSabotageClose();
                        }
                      }}
                    >
                      Pradėti
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={onSabotageClose}
                      _focus={{ boxShadow: "none" }}
                    >
                      Atšaukti
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </>
          ) : (
            ""
          )}
          {currentPlayer.role === "crewmate" ? (
            <>
              {currentPlayer.isDead && (
                <>
                  <Text display="inline">Jūs esate </Text>
                  <Text display="inline" fontWeight="500" color="blue.600">
                    miręs
                  </Text>
                  <Text display="inline">
                    , todėl jūs nebegalite pranešti apie mirusius žaidėjus.
                  </Text>
                  <Text fontWeight="500" color="blue.600">
                    Pabaikite daryti savo užduotis, net jei esate miręs.
                  </Text>
                </>
              )}
              <Text fontWeight="600" fontSize="30px">
                Mano užduotys:
              </Text>
              {gameSabotaged && !currentPlayer.isDead && (
                <Text fontWeight="600" fontSize="20px" color="red.600">
                  Skubios užduotys:
                </Text>
              )}
              {gameSabotageType === "oxygen" && !currentPlayer.isDead ? (
                <>
                  <Text color="red.600" fontWeight="600" mb={1}>
                    Liko laiko:{" "}
                    {moment(gameSabotageEndsAt - 3 * 60 * 60 * 1000).format(
                      "mm:ss"
                    )}
                  </Text>
                  <Flex justifyContent="space-between" alignItems="center">
                    <Text>
                      1. Įveskite virtuvėje ant spintelės esančiame lapelyje
                      nurodytą kodą
                    </Text>
                    <Text
                      color={oxygenFirstDone ? "black" : "blue.600"}
                      onClick={() => {
                        onOxygenFirstOpen();
                      }}
                      whiteSpace="nowrap"
                      pl={1}
                    >
                      {oxygenFirstDone ? "Kodas įvestas" : "Įvesti kodą"}
                    </Text>
                    <Modal
                      isOpen={isOxygenFirstOpen}
                      onClose={onOxygenFirstClose}
                    >
                      <ModalOverlay />
                      <ModalContent>
                        <ModalHeader>Užduoties užbaigimas</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                          Įveskite užduoties kodą:
                          <Input
                            type="number"
                            value={oxygenFirst}
                            onChange={handleOxygenFirstChange}
                            placeholder="Užduoties kodas"
                          />
                        </ModalBody>
                        <ModalFooter>
                          <Button
                            colorScheme="blue"
                            mr={3}
                            onClick={checkOxygenFirst}
                          >
                            Patvirtinti
                          </Button>
                          <Button variant="ghost" onClick={onOxygenFirstClose}>
                            Atšaukti
                          </Button>
                        </ModalFooter>
                      </ModalContent>
                    </Modal>
                  </Flex>
                  <Flex justifyContent="space-between" alignItems="center">
                    <Text>
                      2. Įveskite 3 kambaryje ant sienos esančiame lapelyje
                      nurodytą kodą
                    </Text>
                    <Text
                      color={oxygenSecondDone ? "black" : "blue.600"}
                      onClick={() => {
                        onOxygenSecondOpen();
                      }}
                      whiteSpace="nowrap"
                      pl={1}
                    >
                      {oxygenSecondDone ? "Kodas įvestas" : "Įvesti kodą"}
                    </Text>
                    <Modal
                      isOpen={isOxygenSecondOpen}
                      onClose={onOxygenSecondClose}
                    >
                      <ModalOverlay />
                      <ModalContent>
                        <ModalHeader>Užduoties užbaigimas</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                          Įveskite užduoties kodą:
                          <Input
                            type="number"
                            value={oxygenSecond}
                            onChange={handleOxygenSecondChange}
                            placeholder="Užduoties kodas"
                          />
                        </ModalBody>
                        <ModalFooter>
                          <Button
                            colorScheme="blue"
                            mr={3}
                            onClick={checkOxygenSecond}
                          >
                            Patvirtinti
                          </Button>
                          <Button variant="ghost" onClick={onOxygenSecondClose}>
                            Atšaukti
                          </Button>
                        </ModalFooter>
                      </ModalContent>
                    </Modal>
                  </Flex>
                </>
              ) : gameSabotageType === "comms" && !currentPlayer.isDead ? (
                <Flex justifyContent="space-between" alignItems="center">
                  <Text>
                    1. Įveskite pagrindinėje salėje ant sienos esančiame
                    lapelyje nurodytą kodą, kad vėl matytumėte savo užduotis
                  </Text>
                  <Text
                    color={commsDone ? "black" : "blue.600"}
                    onClick={() => {
                      onCommsOpen();
                    }}
                    whiteSpace="nowrap"
                    pl={1}
                  >
                    {commsDone ? "Kodas įvestas" : "Įvesti kodą"}
                  </Text>
                  <Modal isOpen={isCommsOpen} onClose={onCommsClose}>
                    <ModalOverlay />
                    <ModalContent>
                      <ModalHeader>Užduoties užbaigimas</ModalHeader>
                      <ModalCloseButton />
                      <ModalBody>
                        Įveskite užduoties kodą:
                        <Input
                          type="number"
                          value={comms}
                          onChange={handleCommsChange}
                          placeholder="Užduoties kodas"
                        />
                      </ModalBody>
                      <ModalFooter>
                        <Button colorScheme="blue" mr={3} onClick={checkComms}>
                          Patvirtinti
                        </Button>
                        <Button variant="ghost" onClick={onCommsClose}>
                          Atšaukti
                        </Button>
                      </ModalFooter>
                    </ModalContent>
                  </Modal>
                </Flex>
              ) : (
                ""
              )}
              {currentPlayer.sabotageType === "comms" ? (
                currentPlayer.isDead ? (
                  <>
                    <Text fontWeight="500" fontSize="16px">
                      Lengvos užduotys:
                    </Text>
                    <OrderedList fontSize="14px">
                      {currentPlayer.easyTasks.map((task: any) => (
                        <ListItem key={task.id}>
                          <Flex
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Text>{task.task}</Text>
                            <Text
                              color={task.done ? "black" : "blue.500"}
                              onClick={() => {
                                setCurrentTaskId(task.id);
                                onEasyTaskCodeOpen();
                              }}
                              whiteSpace="nowrap"
                              pl={1}
                            >
                              {task.done ? "Užduotis atlikta" : "Įvesti kodą"}
                            </Text>
                            <Modal
                              isOpen={isEasyTaskCodeOpen}
                              onClose={onEasyTaskCodeClose}
                            >
                              <ModalOverlay />
                              <ModalContent>
                                <ModalHeader>Užduoties užbaigimas</ModalHeader>
                                <ModalCloseButton />
                                <ModalBody>
                                  Įveskite užduoties kodą:
                                  <Input
                                    type="number"
                                    value={easyTaskCode}
                                    onChange={handleEasyTaskCodeChange}
                                    placeholder="Užduoties kodas"
                                  />
                                </ModalBody>
                                <ModalFooter>
                                  <Button
                                    colorScheme="blue"
                                    mr={3}
                                    onClick={() =>
                                      checkEasyTaskCode(currentTaskId)
                                    }
                                  >
                                    Patvirtinti
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    onClick={onEasyTaskCodeClose}
                                  >
                                    Atšaukti
                                  </Button>
                                </ModalFooter>
                              </ModalContent>
                            </Modal>
                          </Flex>
                        </ListItem>
                      ))}
                    </OrderedList>
                    <Text fontWeight="500" fontSize="16px" mt={2}>
                      Vidutinio sunkumo užduotys:
                    </Text>
                    <OrderedList fontSize="14px">
                      {currentPlayer.mediumTasks.map((task: any) => (
                        <ListItem key={task.id}>
                          <Flex
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Text>{task.task}</Text>
                            <Text
                              color={task.done ? "black" : "blue.500"}
                              onClick={() => {
                                setCurrentTaskId(task.id);
                                onMediumTaskCodeOpen();
                              }}
                              whiteSpace="nowrap"
                              pl={1}
                            >
                              {task.done ? "Užduotis atlikta" : "Įvesti kodą"}
                            </Text>
                            <Modal
                              isOpen={isMediumTaskCodeOpen}
                              onClose={onMediumTaskCodeClose}
                            >
                              <ModalOverlay />
                              <ModalContent>
                                <ModalHeader>Užduoties užbaigimas</ModalHeader>
                                <ModalCloseButton />
                                <ModalBody>
                                  Įveskite užduoties kodą:
                                  <Input
                                    type="number"
                                    value={mediumTaskCode}
                                    onChange={handleMediumTaskCodeChange}
                                    placeholder="Užduoties kodas"
                                  />
                                </ModalBody>
                                <ModalFooter>
                                  <Button
                                    colorScheme="blue"
                                    mr={3}
                                    onClick={() =>
                                      checkMediumTaskCode(currentTaskId)
                                    }
                                  >
                                    Patvirtinti
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    onClick={onMediumTaskCodeClose}
                                  >
                                    Atšaukti
                                  </Button>
                                </ModalFooter>
                              </ModalContent>
                            </Modal>
                          </Flex>
                        </ListItem>
                      ))}
                    </OrderedList>
                    <Text fontWeight="500" fontSize="16px" mt={2}>
                      Sunkios užduotys:
                    </Text>
                    <OrderedList fontSize="14px">
                      {currentPlayer.hardTasks.map((task: any) => (
                        <ListItem key={task.id}>
                          <Flex
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Text>{task.task}</Text>
                            <Text
                              color={task.done ? "black" : "blue.500"}
                              onClick={() => {
                                setCurrentTaskId(task.id);
                                onHardTaskCodeOpen();
                              }}
                              whiteSpace="nowrap"
                              pl={1}
                            >
                              {task.done ? "Užduotis atlikta" : "Įvesti kodą"}
                            </Text>
                            <Modal
                              isOpen={isHardTaskCodeOpen}
                              onClose={onHardTaskCodeClose}
                            >
                              <ModalOverlay />
                              <ModalContent>
                                <ModalHeader>Užduoties užbaigimas</ModalHeader>
                                <ModalCloseButton />
                                <ModalBody>
                                  Įveskite užduoties kodą:
                                  <Input
                                    type="number"
                                    value={hardTaskCode}
                                    onChange={handleHardTaskCodeChange}
                                    placeholder="Užduoties kodas"
                                  />
                                </ModalBody>
                                <ModalFooter>
                                  <Button
                                    colorScheme="blue"
                                    mr={3}
                                    onClick={() =>
                                      checkHardTaskCode(currentTaskId)
                                    }
                                  >
                                    Patvirtinti
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    onClick={onHardTaskCodeClose}
                                  >
                                    Atšaukti
                                  </Button>
                                </ModalFooter>
                              </ModalContent>
                            </Modal>
                          </Flex>
                        </ListItem>
                      ))}
                    </OrderedList>
                  </>
                ) : (
                  <></>
                )
              ) : (
                <>
                  <Text fontWeight="500" fontSize="16px">
                    Lengvos užduotys:
                  </Text>
                  <OrderedList fontSize="14px">
                    {currentPlayer.easyTasks.map((task: any) => (
                      <ListItem key={task.id}>
                        <Flex
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Text>{task.task}</Text>
                          <Text
                            color={task.done ? "black" : "blue.500"}
                            onClick={() => {
                              setCurrentTaskId(task.id);
                              onEasyTaskCodeOpen();
                            }}
                            whiteSpace="nowrap"
                            pl={1}
                          >
                            {task.done ? "Užduotis atlikta" : "Įvesti kodą"}
                          </Text>
                          <Modal
                            isOpen={isEasyTaskCodeOpen}
                            onClose={onEasyTaskCodeClose}
                          >
                            <ModalOverlay />
                            <ModalContent>
                              <ModalHeader>Užduoties užbaigimas</ModalHeader>
                              <ModalCloseButton />
                              <ModalBody>
                                Įveskite užduoties kodą:
                                <Input
                                  type="number"
                                  value={easyTaskCode}
                                  onChange={handleEasyTaskCodeChange}
                                  placeholder="Užduoties kodas"
                                />
                              </ModalBody>
                              <ModalFooter>
                                <Button
                                  colorScheme="blue"
                                  mr={3}
                                  onClick={() =>
                                    checkEasyTaskCode(currentTaskId)
                                  }
                                >
                                  Patvirtinti
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={onEasyTaskCodeClose}
                                >
                                  Atšaukti
                                </Button>
                              </ModalFooter>
                            </ModalContent>
                          </Modal>
                        </Flex>
                      </ListItem>
                    ))}
                  </OrderedList>
                  <Text fontWeight="500" fontSize="16px" mt={2}>
                    Vidutinio sunkumo užduotys:
                  </Text>
                  <OrderedList fontSize="14px">
                    {currentPlayer.mediumTasks.map((task: any) => (
                      <ListItem key={task.id}>
                        <Flex
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Text>{task.task}</Text>
                          <Text
                            color={task.done ? "black" : "blue.500"}
                            onClick={() => {
                              setCurrentTaskId(task.id);
                              onMediumTaskCodeOpen();
                            }}
                            whiteSpace="nowrap"
                            pl={1}
                          >
                            {task.done ? "Užduotis atlikta" : "Įvesti kodą"}
                          </Text>
                          <Modal
                            isOpen={isMediumTaskCodeOpen}
                            onClose={onMediumTaskCodeClose}
                          >
                            <ModalOverlay />
                            <ModalContent>
                              <ModalHeader>Užduoties užbaigimas</ModalHeader>
                              <ModalCloseButton />
                              <ModalBody>
                                Įveskite užduoties kodą:
                                <Input
                                  type="number"
                                  value={mediumTaskCode}
                                  onChange={handleMediumTaskCodeChange}
                                  placeholder="Užduoties kodas"
                                />
                              </ModalBody>
                              <ModalFooter>
                                <Button
                                  colorScheme="blue"
                                  mr={3}
                                  onClick={() =>
                                    checkMediumTaskCode(currentTaskId)
                                  }
                                >
                                  Patvirtinti
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={onMediumTaskCodeClose}
                                >
                                  Atšaukti
                                </Button>
                              </ModalFooter>
                            </ModalContent>
                          </Modal>
                        </Flex>
                      </ListItem>
                    ))}
                  </OrderedList>
                  <Text fontWeight="500" fontSize="16px" mt={2}>
                    Sunkios užduotys:
                  </Text>
                  <OrderedList fontSize="14px">
                    {currentPlayer.hardTasks.map((task: any) => (
                      <ListItem key={task.id}>
                        <Flex
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Text>{task.task}</Text>
                          <Text
                            color={task.done ? "black" : "blue.500"}
                            onClick={() => {
                              setCurrentTaskId(task.id);
                              onHardTaskCodeOpen();
                            }}
                            whiteSpace="nowrap"
                            pl={1}
                          >
                            {task.done ? "Užduotis atlikta" : "Įvesti kodą"}
                          </Text>
                          <Modal
                            isOpen={isHardTaskCodeOpen}
                            onClose={onHardTaskCodeClose}
                          >
                            <ModalOverlay />
                            <ModalContent>
                              <ModalHeader>Užduoties užbaigimas</ModalHeader>
                              <ModalCloseButton />
                              <ModalBody>
                                Įveskite užduoties kodą:
                                <Input
                                  type="number"
                                  value={hardTaskCode}
                                  onChange={handleHardTaskCodeChange}
                                  placeholder="Užduoties kodas"
                                />
                              </ModalBody>
                              <ModalFooter>
                                <Button
                                  colorScheme="blue"
                                  mr={3}
                                  onClick={() =>
                                    checkHardTaskCode(currentTaskId)
                                  }
                                >
                                  Patvirtinti
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={onHardTaskCodeClose}
                                >
                                  Atšaukti
                                </Button>
                              </ModalFooter>
                            </ModalContent>
                          </Modal>
                        </Flex>
                      </ListItem>
                    ))}
                  </OrderedList>
                </>
              )}
            </>
          ) : currentPlayer.role === "imposter" ? (
            currentPlayer.isDead ? (
              <>
                <Text display="inline">Jūs esate </Text>
                <Text display="inline" fontWeight="500" color="red.600">
                  miręs
                </Text>
                <Text display="inline">
                  , todėl jūs nebegalite žudyti žaidėjų, tačiau vis dar galite
                  jiems kenkti naudojantis{" "}
                </Text>
                <Text display="inline" fontWeight="500" color="red.600">
                  "Sabotažo"
                </Text>
                <Text display="inline"> funkcija.</Text>
              </>
            ) : (
              <>
                <Text fontWeight="600" fontSize="30px">
                  Mano netikros užduotys:
                </Text>
                {gameSabotaged && !currentPlayer.isDead && (
                  <Text fontWeight="600" fontSize="20px" color="red.600">
                    Skubios užduotys:
                  </Text>
                )}
                {gameSabotageType === "oxygen" && !currentPlayer.isDead ? (
                  <>
                    <Text color="red.600" fontWeight="600" mb={1}>
                      Liko laiko:{" "}
                      {moment(gameSabotageEndsAt - 3 * 60 * 60 * 1000).format(
                        "mm:ss"
                      )}
                    </Text>
                    <Flex justifyContent="space-between" alignItems="center">
                      <Text>
                        1. Įveskite virtuvėje ant spintelės esančiame lapelyje
                        nurodytą kodą
                      </Text>
                      <Text
                        color={oxygenFirstDone ? "black" : "red.600"}
                        onClick={() => {
                          onOxygenFirstOpen();
                        }}
                        whiteSpace="nowrap"
                        pl={1}
                      >
                        {oxygenFirstDone ? "Kodas įvestas" : "Įvesti kodą"}
                      </Text>
                      <Modal
                        isOpen={isOxygenFirstOpen}
                        onClose={onOxygenFirstClose}
                      >
                        <ModalOverlay />
                        <ModalContent>
                          <ModalHeader>Užduoties užbaigimas</ModalHeader>
                          <ModalCloseButton />
                          <ModalBody>
                            Įveskite užduoties kodą:
                            <Input
                              type="number"
                              value={oxygenFirst}
                              onChange={handleOxygenFirstChange}
                              placeholder="Užduoties kodas"
                            />
                          </ModalBody>
                          <ModalFooter>
                            <Button
                              colorScheme="red"
                              mr={3}
                              onClick={checkOxygenFirst}
                            >
                              Patvirtinti
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={onOxygenFirstClose}
                            >
                              Atšaukti
                            </Button>
                          </ModalFooter>
                        </ModalContent>
                      </Modal>
                    </Flex>
                    <Flex justifyContent="space-between" alignItems="center">
                      <Text>
                        2. Įveskite 3 kambaryje ant sienos esančiame lapelyje
                        nurodytą kodą
                      </Text>
                      <Text
                        color={oxygenSecondDone ? "black" : "red.600"}
                        onClick={() => {
                          onOxygenSecondOpen();
                        }}
                        whiteSpace="nowrap"
                        pl={1}
                      >
                        {oxygenSecondDone ? "Kodas įvestas" : "Įvesti kodą"}
                      </Text>
                      <Modal
                        isOpen={isOxygenSecondOpen}
                        onClose={onOxygenSecondClose}
                      >
                        <ModalOverlay />
                        <ModalContent>
                          <ModalHeader>Užduoties užbaigimas</ModalHeader>
                          <ModalCloseButton />
                          <ModalBody>
                            Įveskite užduoties kodą:
                            <Input
                              type="number"
                              value={oxygenSecond}
                              onChange={handleOxygenSecondChange}
                              placeholder="Užduoties kodas"
                            />
                          </ModalBody>
                          <ModalFooter>
                            <Button
                              colorScheme="red"
                              mr={3}
                              onClick={checkOxygenSecond}
                            >
                              Patvirtinti
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={onOxygenSecondClose}
                            >
                              Atšaukti
                            </Button>
                          </ModalFooter>
                        </ModalContent>
                      </Modal>
                    </Flex>
                  </>
                ) : gameSabotageType === "comms" && !currentPlayer.isDead ? (
                  <Flex justifyContent="space-between" alignItems="center">
                    <Text>
                      1. Įveskite pagrindinėje salėje ant sienos esančiame
                      lapelyje nurodytą kodą, kad vėl matytumėte savo užduotis
                    </Text>
                    <Text
                      color={commsDone ? "black" : "red.600"}
                      onClick={() => {
                        onCommsOpen();
                      }}
                      whiteSpace="nowrap"
                      pl={1}
                    >
                      {commsDone ? "Kodas įvestas" : "Įvesti kodą"}
                    </Text>
                    <Modal isOpen={isCommsOpen} onClose={onCommsClose}>
                      <ModalOverlay />
                      <ModalContent>
                        <ModalHeader>Užduoties užbaigimas</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                          Įveskite užduoties kodą:
                          <Input
                            type="number"
                            value={comms}
                            onChange={handleCommsChange}
                            placeholder="Užduoties kodas"
                          />
                        </ModalBody>
                        <ModalFooter>
                          <Button colorScheme="red" mr={3} onClick={checkComms}>
                            Patvirtinti
                          </Button>
                          <Button variant="ghost" onClick={onCommsClose}>
                            Atšaukti
                          </Button>
                        </ModalFooter>
                      </ModalContent>
                    </Modal>
                  </Flex>
                ) : (
                  ""
                )}
                <Text fontWeight="500" fontSize="16px">
                  Lengvos užduotys:
                </Text>
                <OrderedList fontSize="14px">
                  {currentPlayer.easyTasks.map((task: any) => (
                    <ListItem key={task.id}>
                      <Text>{task.task}</Text>
                    </ListItem>
                  ))}
                </OrderedList>
                <Text fontWeight="500" fontSize="16px" mt={2}>
                  Vidutinio sunkumo užduotys:
                </Text>
                <OrderedList fontSize="14px">
                  {currentPlayer.mediumTasks.map((task: any) => (
                    <ListItem key={task.id}>
                      <Text>{task.task}</Text>
                    </ListItem>
                  ))}
                </OrderedList>
                <Text fontWeight="500" fontSize="16px" mt={2}>
                  Sunkios užduotys:
                </Text>
                <OrderedList fontSize="14px">
                  {currentPlayer.hardTasks.map((task: any) => (
                    <ListItem key={task.id}>
                      <Text>{task.task}</Text>
                    </ListItem>
                  ))}
                </OrderedList>
              </>
            )
          ) : (
            <>
              {gameSabotaged && !currentPlayer.isDead && (
                <Text fontWeight="600" fontSize="20px" color="red.600">
                  Skubios užduotys:
                </Text>
              )}
              {gameSabotageType === "oxygen" && !currentPlayer.isDead ? (
                <>
                  <Text color="red.600" fontWeight="600" mb={1}>
                    Liko laiko:{" "}
                    {moment(gameSabotageEndsAt - 3 * 60 * 60 * 1000).format(
                      "mm:ss"
                    )}
                  </Text>
                  <Flex justifyContent="space-between" alignItems="center">
                    <Text>
                      1. Įveskite virtuvėje ant spintelės esančiame lapelyje
                      nurodytą kodą
                    </Text>
                    <Text
                      color={oxygenFirstDone ? "black" : "blue.600"}
                      onClick={() => {
                        onOxygenFirstOpen();
                      }}
                      whiteSpace="nowrap"
                      pl={1}
                    >
                      {oxygenFirstDone ? "Kodas įvestas" : "Įvesti kodą"}
                    </Text>
                    <Modal
                      isOpen={isOxygenFirstOpen}
                      onClose={onOxygenFirstClose}
                    >
                      <ModalOverlay />
                      <ModalContent>
                        <ModalHeader>Užduoties užbaigimas</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                          Įveskite užduoties kodą:
                          <Input
                            type="number"
                            value={oxygenFirst}
                            onChange={handleOxygenFirstChange}
                            placeholder="Užduoties kodas"
                          />
                        </ModalBody>
                        <ModalFooter>
                          <Button
                            colorScheme="blue"
                            mr={3}
                            onClick={checkOxygenFirst}
                          >
                            Patvirtinti
                          </Button>
                          <Button variant="ghost" onClick={onOxygenFirstClose}>
                            Atšaukti
                          </Button>
                        </ModalFooter>
                      </ModalContent>
                    </Modal>
                  </Flex>
                  <Flex justifyContent="space-between" alignItems="center">
                    <Text>
                      2. Įveskite 3 kambaryje ant sienos esančiame lapelyje
                      nurodytą kodą
                    </Text>
                    <Text
                      color={oxygenSecondDone ? "black" : "blue.600"}
                      onClick={() => {
                        onOxygenSecondOpen();
                      }}
                      whiteSpace="nowrap"
                      pl={1}
                    >
                      {oxygenSecondDone ? "Kodas įvestas" : "Įvesti kodą"}
                    </Text>
                    <Modal
                      isOpen={isOxygenSecondOpen}
                      onClose={onOxygenSecondClose}
                    >
                      <ModalOverlay />
                      <ModalContent>
                        <ModalHeader>Užduoties užbaigimas</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                          Įveskite užduoties kodą:
                          <Input
                            type="number"
                            value={oxygenSecond}
                            onChange={handleOxygenSecondChange}
                            placeholder="Užduoties kodas"
                          />
                        </ModalBody>
                        <ModalFooter>
                          <Button
                            colorScheme="blue"
                            mr={3}
                            onClick={checkOxygenSecond}
                          >
                            Patvirtinti
                          </Button>
                          <Button variant="ghost" onClick={onOxygenSecondClose}>
                            Atšaukti
                          </Button>
                        </ModalFooter>
                      </ModalContent>
                    </Modal>
                  </Flex>
                </>
              ) : gameSabotageType === "comms" && !currentPlayer.isDead ? (
                <Flex justifyContent="space-between" alignItems="center">
                  <Text>
                    1. Įveskite pagrindinėje salėje ant sienos esančiame
                    lapelyje nurodytą kodą, kad vėl matytumėte savo užduotis
                  </Text>
                  <Text
                    color={commsDone ? "black" : "blue.600"}
                    onClick={() => {
                      onCommsOpen();
                    }}
                    whiteSpace="nowrap"
                    pl={1}
                  >
                    {commsDone ? "Kodas įvestas" : "Įvesti kodą"}
                  </Text>
                  <Modal isOpen={isCommsOpen} onClose={onCommsClose}>
                    <ModalOverlay />
                    <ModalContent>
                      <ModalHeader>Užduoties užbaigimas</ModalHeader>
                      <ModalCloseButton />
                      <ModalBody>
                        Įveskite užduoties kodą:
                        <Input
                          type="number"
                          value={comms}
                          onChange={handleCommsChange}
                          placeholder="Užduoties kodas"
                        />
                      </ModalBody>
                      <ModalFooter>
                        <Button colorScheme="blue" mr={3} onClick={checkComms}>
                          Patvirtinti
                        </Button>
                        <Button variant="ghost" onClick={onCommsClose}>
                          Atšaukti
                        </Button>
                      </ModalFooter>
                    </ModalContent>
                  </Modal>
                </Flex>
              ) : (
                ""
              )}
            </>
          )}
          <Text fontWeight="600" fontSize="30px" mt={6} mb={2}>
            Žaidėjai:
          </Text>
          {playersInGame &&
            playersInGame.map((player: any, index: number) => {
              if (currentPlayerIndex !== index)
                if (player.role !== "admin")
                  return (
                    <PlayerInGame
                      key={player.id}
                      info={player}
                      setWinImposters={setWinImposters}
                      setWinCrewmates={setWinCrewmates}
                      setMeetStarting={setMeetStarting}
                      isAdmin={isCurrentPlayerAdmin}
                    />
                  );
            })}
          {isCurrentPlayerAdmin && (
            <>
              <Button
                mt={4}
                colorScheme="gray"
                onClick={onTasksCodesOpen}
                width="100%"
              >
                Užduočių kodai
              </Button>
              <Modal isOpen={isTasksCodesOpen} onClose={onTasksCodesClose}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Užduočių kodai</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>
                    <OrderedList>
                      {allTasks.map((task) => (
                        <ListItem key={task.id}>{task.code}</ListItem>
                      ))}
                    </OrderedList>
                  </ModalBody>
                  <ModalFooter>
                    <Button variant="ghost" onClick={onTasksCodesClose}>
                      Grįžti
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </>
          )}
          {isCurrentPlayerAdmin && (
            <>
              <Button
                mt={4}
                colorScheme="gray"
                onClick={onPauseGameOpen}
                width="100%"
              >
                Pristabdyti žaidimą
              </Button>
              <Modal isOpen={isPauseGameOpen} onClose={onPauseGameClose}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Pristabdyti žaidimą</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>Ar tikrai norite pristabdyti žaidimą?</ModalBody>
                  <ModalFooter>
                    <Button colorScheme="green" mr={3} onClick={pauseGame}>
                      Patvirtinti
                    </Button>
                    <Button variant="ghost" onClick={onPauseGameClose}>
                      Atšaukti
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </>
          )}
          {isCurrentPlayerAdmin && (
            <>
              <Button
                mt={4}
                colorScheme="gray"
                isLoading={gameResetting}
                onClick={onResetGameOpen}
                width="100%"
              >
                Pradėti žaidimą iš naujo
              </Button>
              <Modal isOpen={isResetGameOpen} onClose={onResetGameClose}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Pradėti žaidimą iš naujo</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>
                    Ar tikrai norite pradėti žaidimą iš naujo?
                  </ModalBody>
                  <ModalFooter>
                    <Button colorScheme="green" mr={3} onClick={resetGame}>
                      Patvirtinti
                    </Button>
                    <Button variant="ghost" onClick={onResetGameClose}>
                      Atšaukti
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </>
          )}
          <Text fontWeight="600" fontSize="30px" mt={6} mb={2}>
            Logs:
          </Text>
          {allLogs?.map((log) => (
            <Text key={log.id}>
              [{log.id.substring(11, 12)}
              {parseInt(log.id.substring(12, 13)) + 2}
              {log.id.substring(13, 19)}] {log.name} - {log.action}
            </Text>
          ))}
        </Box>
      )}
    </>
  );
}

function Player(props: any) {
  const { name, uid, ready, inGame, role } = props.info;
  const admin = props.isAdmin;
  const playersRef = firestore.collection("players");
  const currentPlayerRef = playersRef.doc(uid);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const joinGame = async () => {
    await currentPlayerRef.update({
      ready: true,
      readyAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "joinGame",
    });
  };
  const [playerName, setPlayerName] = useState(name);
  const handlePlayerNameChange = (e: any) => setPlayerName(e.target.value);
  const onChangePlayerName = async () => {
    await currentPlayerRef.update({
      name: playerName,
    });
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "changePlayerName?player=" + name,
    });
    setPlayerName(name);
    onClose();
  };
  return (
    <>
      <Flex alignItems="center" justifyContent="space-between" mb={2}>
        <Text fontWeight={auth.currentUser?.uid === uid ? "600" : "400"}>
          {name} {admin && <EditIcon onClick={onOpen} />}
        </Text>
        {role === "dq" ? (
          <Text color="red.600">Diskvalifikuotas</Text>
        ) : inGame ? (
          <Text color="green.600">Jau žaidžia</Text>
        ) : ready ? (
          <Text color="green.600">Pasiruošęs</Text>
        ) : auth.currentUser?.uid === uid ? (
          <Button variant="link" color="blue.600" onClick={joinGame}>
            Pažymėti, kad pasiruošęs
          </Button>
        ) : (
          <Text color="red.600">Nepasiruošęs</Text>
        )}
      </Flex>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Keisti žaidėjo vardą</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Input value={playerName} onChange={handlePlayerNameChange} />
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onChangePlayerName}>
              Keisti žaidėjo vardą
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Uždaryti
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

function PlayerInGame(props: any) {
  const { name, uid, isDead, role, doneTasks, isReported } = props.info;
  const playersRef = firestore.collection("players");
  const aliveCrewmatesRef = firestore
    .collection("players")
    .where("role", "==", "crewmate")
    .where("isDead", "==", false);
  const aliveImpostersRef = firestore
    .collection("players")
    .where("role", "==", "imposter")
    .where("isDead", "==", false);
  const deadCrewmatesRef = firestore
    .collection("players")
    .where("role", "==", "crewmate")
    .where("isDead", "==", true)
    .where("isReported", "==", false);
  const [aliveCrewmates] = useCollectionData(aliveCrewmatesRef, {
    idField: "id",
  });
  const [aliveImposters] = useCollectionData(aliveImpostersRef, {
    idField: "id",
  });
  const currentPlayerRef = playersRef.doc(auth.currentUser?.uid);
  const [currentPlayer]: any = useDocument(currentPlayerRef);
  const {
    isOpen: isKickPlayerOpen,
    onOpen: onKickPlayerOpen,
    onClose: onKickPlayerClose,
  } = useDisclosure();
  const {
    isOpen: isKillPlayerOpen,
    onOpen: onKillPlayerOpen,
    onClose: onKillPlayerClose,
  } = useDisclosure();
  const {
    isOpen: isReportPlayerOpen,
    onOpen: onReportPlayerOpen,
    onClose: onReportPlayerClose,
  } = useDisclosure();
  const {
    isOpen: isVotePlayerOpen,
    onOpen: onVotePlayerOpen,
    onClose: onVotePlayerClose,
  } = useDisclosure();
  const toast = useToast();
  const [countdown, setCountdown] = useState(
    currentPlayer?.data().cooldownEndsAt
      ? currentPlayer?.data().cooldownEndsAt - Date.now()
      : Date.now()
  );
  const [impostersWin, setImpostersWin] = useState(false);
  const [crewmatesWin, setCrewmatesWin] = useState(false);
  const [meetingStarting, setMeetingStarting] = useState(false);
  useEffect(() => {
    const interval = setInterval(
      () =>
        setCountdown(
          currentPlayer?.data().cooldownEndsAt
            ? currentPlayer?.data().cooldownEndsAt - Date.now()
            : Date.now()
        ),
      1000
    );
    return () => {
      clearInterval(interval);
    };
  }, [countdown]);
  useEffect(() => {
    props.setWinImposters(impostersWin);
  }, [props.setWinImposters, impostersWin]);
  useEffect(() => {
    props.setWinCrewmates(crewmatesWin);
  }, [props.setWinCrewmates, crewmatesWin]);
  useEffect(() => {
    props.setMeetStarting(meetingStarting);
  }, [props.setMeetStarting, meetingStarting]);
  if (!currentPlayer?.data() || !aliveCrewmates || !aliveImposters)
    return (
      <>
        Kraunama...
        <br />
      </>
    );
  const kickPlayer = async (userid: string) => {
    const playerRef = firestore.collection("players").doc(userid);
    await playerRef.update({
      inGame: false,
      ready: false,
      role: "dq",
      screenHidden: false,
    });
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "kickPlayer?player=" + name,
    });
    onKickPlayerClose();
    if (role === "imposter") {
      if (aliveImposters?.length - 1 === 0) {
        const batch = firestore.batch();
        const allPlayers = await playersRef.get();
        allPlayers.forEach((doc) => {
          batch.update(playersRef.doc(doc.id), {
            win: "crewmates",
          });
        });
        await batch.commit();
        const logsRef = firestore
          .collection("logs")
          .doc(new Date().toISOString());
        await logsRef.set({
          name: auth.currentUser?.displayName,
          uid: auth.currentUser?.uid,
          action: "crewmatesWinAfterKick",
        });
        setCrewmatesWin(true);
      }
    } else if (role === "crewmate") {
      if (aliveImposters?.length >= aliveCrewmates?.length - 1) {
        const batch = firestore.batch();
        const allPlayers = await playersRef.get();
        allPlayers.forEach((doc) => {
          batch.update(playersRef.doc(doc.id), {
            win: "imposters",
          });
        });
        await batch.commit();
        const logsRef = firestore
          .collection("logs")
          .doc(new Date().toISOString());
        await logsRef.set({
          name: auth.currentUser?.displayName,
          uid: auth.currentUser?.uid,
          action: "impostersWinAfterKick",
        });
        setImpostersWin(true);
      }
    }
  };
  const killPlayer = async (userid: string) => {
    if (currentPlayer?.data().cooldownEndsAt >= Date.now()) {
      toast({
        title: "Žaidėjas nenužudytas",
        description:
          "Žaidėjas negali būti nužudytas nes dar nesibaigė jūsų laikas po praėjusio nužudymo.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } else {
      await currentPlayerRef.update({
        cooldownEndsAt: Date.now() + 90000,
      });
      setCountdown(Date.now() + 90000);
      const playerRef = firestore.collection("players").doc(userid);
      await playerRef.update({
        isDead: true,
        killedBy: currentPlayer?.data().name,
      });
      const logsRef = firestore
        .collection("logs")
        .doc(new Date().toISOString());
      await logsRef.set({
        name: auth.currentUser?.displayName,
        uid: auth.currentUser?.uid,
        action: "killPlayer?player=" + name,
      });
      onKillPlayerClose();
      if (aliveImposters?.length >= aliveCrewmates?.length - 1) {
        const batch = firestore.batch();
        const allPlayers = await playersRef.get();
        allPlayers.forEach((doc) => {
          batch.update(playersRef.doc(doc.id), {
            win: "imposters",
          });
        });
        await batch.commit();
        const logsRef = firestore
          .collection("logs")
          .doc(new Date().toISOString());
        await logsRef.set({
          name: auth.currentUser?.displayName,
          uid: auth.currentUser?.uid,
          action: "impostersWinAfterKill",
        });
        setImpostersWin(true);
      }
    }
  };
  const votePlayer = async (userid: string) => {
    const playerRef = firestore.collection("players").doc(userid);
    await playerRef.update({
      isDead: true,
      killedBy: "voted",
    });
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "votePlayer?player=" + name,
    });
    onVotePlayerClose();
    if (role === "imposter") {
      if (aliveImposters?.length - 1 === 0) {
        const batch = firestore.batch();
        const allPlayers = await playersRef.get();
        allPlayers.forEach((doc) => {
          batch.update(playersRef.doc(doc.id), {
            win: "crewmates",
          });
        });
        const logsRef = firestore
          .collection("logs")
          .doc(new Date().toISOString());
        await logsRef.set({
          name: auth.currentUser?.displayName,
          uid: auth.currentUser?.uid,
          action: "crewmatesWinAfterVote",
        });
        await batch.commit();
        setCrewmatesWin(true);
      }
    } else if (role === "crewmate") {
      if (aliveImposters?.length >= aliveCrewmates?.length - 1) {
        const batch = firestore.batch();
        const allPlayers = await playersRef.get();
        allPlayers.forEach((doc) => {
          batch.update(playersRef.doc(doc.id), {
            win: "imposters",
          });
        });
        await batch.commit();
        const logsRef = firestore
          .collection("logs")
          .doc(new Date().toISOString());
        await logsRef.set({
          name: auth.currentUser?.displayName,
          uid: auth.currentUser?.uid,
          action: "impostersWinAfterVote",
        });
        setImpostersWin(true);
      }
    }
  };
  const reportPlayer = async (userid: string) => {
    if (currentPlayer?.data().isReported) {
      toast({
        title: "Apie žaidėją jau pranešta",
        description: "Apie šio žaidėjo mirtį jau pranešta.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } else {
      const deadCrewmates = await deadCrewmatesRef.get();
      const deadCrewmatesBatch = firestore.batch();
      deadCrewmates.forEach((doc) => {
        deadCrewmatesBatch.update(playersRef.doc(doc.id), {
          isReported: true,
        });
      });
      await deadCrewmatesBatch.commit();
      const playerRef = firestore.collection("players").doc(userid);
      await playerRef.update({
        foundBy: currentPlayer?.data().name,
      });
      const logsRef = firestore
        .collection("logs")
        .doc(new Date().toISOString());
      await logsRef.set({
        name: auth.currentUser?.displayName,
        uid: auth.currentUser?.uid,
        action: "reportPlayer?player=" + name,
      });
      const batch = firestore.batch();
      const allPlayers = await playersRef.get();
      allPlayers.forEach((doc) => {
        batch.update(playersRef.doc(doc.id), {
          isMeetingStarting: true,
        });
      });
      await batch.commit();
      setMeetingStarting(true);
      onReportPlayerClose();
    }
  };
  return (
    <>
      <Flex alignItems="center" justifyContent="space-between" mb={2}>
        <Flex alignItems="center">
          <Text
            fontWeight={
              auth.currentUser?.uid === uid
                ? "600"
                : currentPlayer?.data().role === "admin" && role === "imposter"
                ? "600"
                : currentPlayer?.data().role === "admin" && role === "crewmate"
                ? "600"
                : "400"
            }
            color={
              currentPlayer?.data().role === "admin" && role === "imposter"
                ? "red.600"
                : currentPlayer?.data().role === "admin" && role === "crewmate"
                ? "blue.600"
                : "black"
            }
          >
            {name}
          </Text>
          {currentPlayer?.data().role === "admin" && role === "crewmate" && (
            <Text ml={1}>({doneTasks}/6)</Text>
          )}
          {currentPlayer?.data().role === "admin" && isDead && (
            <WarningTwoIcon color="red.600" ml={1} />
          )}
        </Flex>
        {auth.currentUser?.uid !== uid &&
          (currentPlayer?.data().role === "crewmate" ? (
            !currentPlayer?.data().isDead ? (
              <>
                {isReported ? (
                  <Text color="red.600">Žaidėjas miręs</Text>
                ) : (
                  <Text color="blue.600" onClick={onReportPlayerOpen}>
                    Pranešti apie mirusį
                  </Text>
                )}
                <Modal
                  onClose={onReportPlayerClose}
                  isOpen={isReportPlayerOpen}
                >
                  <ModalOverlay />
                  <ModalContent>
                    <ModalHeader>Pranešti apie mirusį žaidėją</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                      <Text display="inline">Ar tikrai radote žaidėjo </Text>
                      <Text display="inline" fontWeight="600">
                        {name}
                      </Text>
                      <Text display="inline"> kepurę?</Text>
                    </ModalBody>
                    <ModalFooter>
                      <Button
                        colorScheme="blue"
                        mr={3}
                        onClick={() => reportPlayer(uid)}
                      >
                        Patvirtinti
                      </Button>
                      <Button variant="ghost" onClick={onReportPlayerClose}>
                        Atšaukti
                      </Button>
                    </ModalFooter>
                  </ModalContent>
                </Modal>
              </>
            ) : (
              ""
            )
          ) : currentPlayer?.data().role === "admin" ? (
            currentPlayer?.data().isMeetingStarted ? (
              <>
                <Text color="green.600" onClick={onVotePlayerOpen}>
                  Išbalsuoti žaidėją
                </Text>
                <Modal onClose={onVotePlayerClose} isOpen={isVotePlayerOpen}>
                  <ModalOverlay />
                  <ModalContent>
                    <ModalHeader>Išbalsuoti žaidėją</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                      <Text display="inline">Ar tikrai norite išbalsuoti </Text>
                      <Text display="inline" fontWeight="600">
                        {name}
                      </Text>
                      <Text display="inline"> iš žaidimo?</Text>
                    </ModalBody>
                    <ModalFooter>
                      <Button
                        colorScheme="green"
                        mr={3}
                        onClick={() => votePlayer(uid)}
                      >
                        Patvirtinti
                      </Button>
                      <Button variant="ghost" onClick={onVotePlayerClose}>
                        Atšaukti
                      </Button>
                    </ModalFooter>
                  </ModalContent>
                </Modal>
              </>
            ) : (
              <>
                <Text color="green.600" onClick={onKickPlayerOpen}>
                  Diskvalifikuoti žaidėją
                </Text>
                <Modal onClose={onKickPlayerClose} isOpen={isKickPlayerOpen}>
                  <ModalOverlay />
                  <ModalContent>
                    <ModalHeader>Diskvalifikuoti žaidėją</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                      <Text display="inline">
                        Ar tikrai norite diskvalifikuoti{" "}
                      </Text>
                      <Text display="inline" fontWeight="600">
                        {name}
                      </Text>
                      <Text display="inline"> iš žaidimo?</Text>
                    </ModalBody>
                    <ModalFooter>
                      <Button
                        colorScheme="green"
                        mr={3}
                        onClick={() => kickPlayer(uid)}
                      >
                        Patvirtinti
                      </Button>
                      <Button variant="ghost" onClick={onKickPlayerClose}>
                        Atšaukti
                      </Button>
                    </ModalFooter>
                  </ModalContent>
                </Modal>
              </>
            )
          ) : isDead ? (
            <Text color="red.600">Žaidėjas miręs</Text>
          ) : role !== "imposter" ? (
            !currentPlayer?.data().isDead && countdown > 0 ? (
              <Text color="red.600">
                {moment(countdown - 3 * 60 * 60 * 1000).format("mm:ss")}
              </Text>
            ) : !currentPlayer?.data().isDead ? (
              <>
                <Text color="red.600" onClick={onKillPlayerOpen}>
                  Nužudyti
                </Text>
                <Modal onClose={onKillPlayerClose} isOpen={isKillPlayerOpen}>
                  <ModalOverlay />
                  <ModalContent>
                    <ModalHeader>Nužudyti žaidėją</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                      <Text display="inline">
                        Ar tikrai numušėte kepurę žaidėjui{" "}
                      </Text>
                      <Text display="inline" fontWeight="600">
                        {name}
                      </Text>
                      <Text display="inline"> fiziškai?</Text>
                    </ModalBody>
                    <ModalFooter>
                      <Button
                        colorScheme="red"
                        mr={3}
                        onClick={() => killPlayer(uid)}
                      >
                        Patvirtinti
                      </Button>
                      <Button variant="ghost" onClick={onKillPlayerClose}>
                        Atšaukti
                      </Button>
                    </ModalFooter>
                  </ModalContent>
                </Modal>
              </>
            ) : (
              ""
            )
          ) : (
            <Text color="red.600" fontWeight="600">
              Apsimetėlis
            </Text>
          ))}
      </Flex>
    </>
  );
}

function PlayerInGameInMeeting(props: any) {
  const { name, uid, isDead, role, doneTasks, isReported } = props.info;
  const playersRef = firestore.collection("players");
  const aliveCrewmatesRef = firestore
    .collection("players")
    .where("role", "==", "crewmate")
    .where("isDead", "==", false);
  const aliveImpostersRef = firestore
    .collection("players")
    .where("role", "==", "imposter")
    .where("isDead", "==", false);
  const [aliveCrewmates] = useCollectionData(aliveCrewmatesRef, {
    idField: "id",
  });
  const [aliveImposters] = useCollectionData(aliveImpostersRef, {
    idField: "id",
  });
  const currentPlayerRef = playersRef.doc(auth.currentUser?.uid);
  const [currentPlayer]: any = useDocument(currentPlayerRef);
  const {
    isOpen: isVotePlayerOpen,
    onOpen: onVotePlayerOpen,
    onClose: onVotePlayerClose,
  } = useDisclosure();
  const [impostersWin, setImpostersWin] = useState(false);
  const [crewmatesWin, setCrewmatesWin] = useState(false);
  useEffect(() => {
    props.setWinImposters(impostersWin);
  }, [props.setWinImposters, impostersWin]);
  useEffect(() => {
    props.setWinCrewmates(crewmatesWin);
  }, [props.setWinCrewmates, crewmatesWin]);
  if (!currentPlayer?.data() || !aliveCrewmates || !aliveImposters)
    return (
      <>
        Kraunama...
        <br />
      </>
    );
  const votePlayer = async (userid: string) => {
    const playerRef = firestore.collection("players").doc(userid);
    await playerRef.update({
      isDead: true,
      killedBy: "voted",
    });
    const logsRef = firestore.collection("logs").doc(new Date().toISOString());
    await logsRef.set({
      name: auth.currentUser?.displayName,
      uid: auth.currentUser?.uid,
      action: "votePlayer?player=" + name,
    });
    onVotePlayerClose();
    if (role === "imposter") {
      if (aliveImposters?.length - 1 === 0) {
        const batch = firestore.batch();
        const allPlayers = await playersRef.get();
        allPlayers.forEach((doc) => {
          batch.update(playersRef.doc(doc.id), {
            win: "crewmates",
          });
        });
        await batch.commit();
        const logsRef = firestore
          .collection("logs")
          .doc(new Date().toISOString());
        await logsRef.set({
          name: auth.currentUser?.displayName,
          uid: auth.currentUser?.uid,
          action: "crewmatesWinAfterVote",
        });
        setCrewmatesWin(true);
      }
    } else if (role === "crewmate") {
      if (aliveImposters?.length >= aliveCrewmates?.length - 1) {
        const batch = firestore.batch();
        const allPlayers = await playersRef.get();
        allPlayers.forEach((doc) => {
          batch.update(playersRef.doc(doc.id), {
            win: "imposters",
          });
        });
        await batch.commit();
        const logsRef = firestore
          .collection("logs")
          .doc(new Date().toISOString());
        await logsRef.set({
          name: auth.currentUser?.displayName,
          uid: auth.currentUser?.uid,
          action: "impostersWinAfterVote",
        });
        setImpostersWin(true);
      }
    }
  };
  return (
    <>
      <Flex alignItems="center" justifyContent="space-between" mb={2}>
        <Flex alignItems="center">
          <Text
            fontWeight={
              auth.currentUser?.uid === uid
                ? "600"
                : currentPlayer?.data().role === "admin" && role === "imposter"
                ? "600"
                : currentPlayer?.data().role === "admin" && role === "crewmate"
                ? "600"
                : "400"
            }
            color={
              currentPlayer?.data().role === "admin" && role === "imposter"
                ? "red.600"
                : currentPlayer?.data().role === "admin" && role === "crewmate"
                ? "blue.600"
                : "black"
            }
          >
            {name}
          </Text>
          {currentPlayer?.data().role === "admin" && role === "crewmate" && (
            <Text ml={1}>({doneTasks}/6)</Text>
          )}
          {currentPlayer?.data().role === "admin" && isDead && (
            <WarningTwoIcon color="red.600" ml={1} />
          )}
        </Flex>
        {auth.currentUser?.uid !== uid &&
          (currentPlayer?.data().role === "crewmate" ? (
            !currentPlayer?.data().isDead ? (
              <>
                {isReported ? (
                  <Text color="red.600">Žaidėjas miręs</Text>
                ) : (
                  <Text color="blue.600">Žaidėjas gyvas</Text>
                )}
              </>
            ) : (
              ""
            )
          ) : currentPlayer?.data().role === "admin" ? (
            currentPlayer?.data().isMeetingStarted &&
            !isDead && (
              <>
                <Text color="green.600" onClick={onVotePlayerOpen}>
                  Išbalsuoti žaidėją
                </Text>
                <Modal onClose={onVotePlayerClose} isOpen={isVotePlayerOpen}>
                  <ModalOverlay />
                  <ModalContent>
                    <ModalHeader>Išbalsuoti žaidėją</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                      <Text display="inline">Ar tikrai norite išbalsuoti </Text>
                      <Text display="inline" fontWeight="600">
                        {name}
                      </Text>
                      <Text display="inline"> iš žaidimo?</Text>
                    </ModalBody>
                    <ModalFooter>
                      <Button
                        colorScheme="green"
                        mr={3}
                        onClick={() => votePlayer(uid)}
                      >
                        Patvirtinti
                      </Button>
                      <Button variant="ghost" onClick={onVotePlayerClose}>
                        Atšaukti
                      </Button>
                    </ModalFooter>
                  </ModalContent>
                </Modal>
              </>
            )
          ) : isDead ? (
            <Text color="red.600">Žaidėjas miręs</Text>
          ) : (
            <Text color="red.600" fontWeight="600">
              Apsimetėlis
            </Text>
          ))}
      </Flex>
    </>
  );
}

export default App;
