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
      if (!player.exists)
        await playersRef.set({
          joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
          name: user?.displayName,
          uid: user?.uid,
          ready: false,
          inGame: false,
          role: "player",
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
  if (
    !players ||
    !playersReady ||
    !currentPlayer ||
    !playersInGame ||
    !allPlayers
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
      const easyTasks = [
        {
          task: "Pasiimkite popieriaus lapą su siluetu iš 1 kambario ir su šalia esančiais pieštukais užspalvinkite siluetą, panaudodami bent 2 skirtingų spalvų pieštukus. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite užspalvintą siluetą moderatoriui esančiam pagrindinėje salėje prie stalo.",
          done: false,
          id: 1,
          code: 937722,
        },
        {
          task: "Pasiimkite popieriaus lapą su siluetu iš 4 kambario ir su šalia esančiomis žirklėmis iškirpkite popieriuje esantį siluetą. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite iškirptą siluetą moderatoriui esančiam virtuvėje.",
          done: false,
          id: 2,
          code: 497152,
        },
        {
          task: "Pasiimkite tuščią popieriaus lapą iš 2 kambario ir su šalia esančiu tušinuku užrašykite visą lietuvišką abėcelę. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite lapą su jame užrašyta abėcele moderatoriui esančiam 3 kambaryje.",
          done: false,
          id: 3,
          code: 648438,
        },
        {
          task: "Pasiimkite tuščią popieriaus lapą iš 2 kambario ir su šalia esančiu tušinuku apipieškite savo kairę ranką. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite lapą su jame apibrėžta jūsų kaire ranka moderatoriui esančiam virtuvėje.",
          done: false,
          id: 4,
          code: 409546,
        },
        {
          task: "Pasiimkite tuščią popieriaus lapą iš 2 kambario ir išlankstykite iš jo lėktuvėlį. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite išlankstytą lėktuvėlį moderatoriui esančiam pagrindinėje salėje prie stalo.",
          done: false,
          id: 5,
          code: 897065,
        },
        {
          task: "Įmeskite kauliuką į puodelį virtuvėje iš 2 metrų atstumo. Įvykdžius užduotį kodą reikalingą užduočiai užbaigti jums duos moderatorius.",
          done: false,
          id: 6,
          code: 935744,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant įėjimo durų kabo lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 7,
          code: 996364,
        },
        {
          task: "Viduje prie išėjimo kabo lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 8,
          code: 226305,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant suoliuko prie šašlykinės guli lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 9,
          code: 843459,
        },
        {
          task: "Raskite lapą 7 kambaryje su nuoroda failo atsisiuntimui. Užduoties kodą rasite atsisiuntę ir atidarę failą.",
          done: false,
          id: 10,
          code: 942599,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke prie kairiojo įvažiavimo ant medžio su nuoroda failo atsisiuntimui. Užduoties kodą rasite atsisiuntę ir atidarę failą.",
          done: false,
          id: 11,
          code: 818088,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant medžio, esančio prie pastato, su nuoroda failo atsisiuntimui. Užduoties kodą rasite atsisiuntę ir atidarę failą.",
          done: false,
          id: 12,
          code: 961767,
        },
        {
          task: "Apsirenkite šiltai. Raskite paslėptą puodelį pavėsinėje, ant kurio yra užklijuotas užduoties kodas.",
          done: false,
          id: 13,
          code: 918217,
        },
        {
          task: "Apsirenkite šiltai. Raskite paslėptą puodelį lauke prie pastato, ant kurio yra užklijuotas užduoties kodas.",
          done: false,
          id: 14,
          code: 895446,
        },
        {
          task: "Raskite paslėptą puodelį 9 kambaryje, ant kurio yra užklijuotas užduoties kodas.",
          done: false,
          id: 15,
          code: 774747,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant pastato, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 16,
          code: 304306,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant vienos iš mašinų, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 17,
          code: 990507,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant vieno iš medžių kairiame įvažiavime, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 18,
          code: 375619,
        },
        {
          task: "Paimkite lapą iš virtuvės, ant kurio yra matematinė užduotis. Užduoties kodą gausite išsprendę užduotį.",
          done: false,
          id: 19,
          code: 526140,
        },
        {
          task: "Paimkite lapą iš 8 kambario, ant kurio yra matematinė užduotis. Užduoties kodą gausite išsprendę užduotį.",
          done: false,
          id: 20,
          code: 515255,
        },
        {
          task: "Paimkite lapą iš 6 kambario, ant kurio yra matematinė užduotis. Užduoties kodą gausite išsprendę užduotį.",
          done: false,
          id: 21,
          code: 171023,
        },
        {
          task: "7 kambaryje rasite daug užverstų lapų. Atvertinėkite lapus, tol kol rasite ant vieno iš jų parašytą užduoties kodą. Nepamirškite įvykdę užduotį užversti lapų atgal.",
          done: false,
          id: 22,
          code: 791335,
        },
        {
          task: "5 kambaryje kabo lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 23,
          code: 841671,
        },
        {
          task: "Raskite lapą 5 kambaryje, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 24,
          code: 746019,
        },
      ];
      const mediumTasks = [
        {
          task: "Pasiimkite popieriaus lapą su jame esančiu testu iš 3 kambario ir su šalia esančiu tušinuku pažymėkite teisingus atsakymus teste. Kodas reikalingas išspręsti užduočiai - šalia teisingų variantų esantys skaičiai iš eilės. Išspręsta testą atiduokite kambaryje esančiam moderatoriui.",
          done: false,
          id: 25,
          code: 655039,
        },
        {
          task: "Apsirenkite šiltai. Pripūskite ir susprogdinkite balioną, kuris yra pririštas prie pavėsinės. Užduoties kodas - baliono viduje.",
          done: false,
          id: 26,
          code: 899421,
        },
        {
          task: "Sujunkite laidus pagal spalvas 2 kambaryje. Užduoties kodas - sudėkite mėlyno laido pradžios poziciją ir raudono laido pabaigos poziciją ir gautą skaičių pakelkite 9 laipsniu. Įvykdžius užduotį laidus atjunkite.",
          done: false,
          id: 27,
          code: 262144,
        },
        {
          task: "Sujunkite laidus pagal spalvas 4 kambaryje. Užduoties kodas - sudėkite geltono laido pradžios poziciją ir geltono laido pabaigos poziciją ir gautą skaičių pakelkite 7 laipsniu. Įvykdžius užduotį laidus atjunkite.",
          done: false,
          id: 28,
          code: 279936,
        },
        {
          task: "Sujunkite laidus pagal spalvas 5 kambaryje. Užduoties kodas - sudėkite rožinio laido pradžios poziciją ir mėlyno laido pabaigos poziciją ir gautą skaičių pakelkite 12 laipsniu. Įvykdžius užduotį laidus atjunkite.",
          done: false,
          id: 29,
          code: 531441,
        },
        {
          task: "Apsirenkite šiltai. Lauke prie dešiniojo įvažiavimo į sodybą ant vieno iš medžių kabo lapas su brailio raštu. Iššifruokite brailio raštu parašytus skaičius ir įveskite juos, kad užbaigtumėte užduotį.",
          done: false,
          id: 30,
          code: 485736,
        },
        {
          task: "Apsirenkite šiltai. Lauke prie pavesinės ant medžio kabo lapas su brailio raštu. Iššifruokite brailio raštu parašytus skaičius ir įveskite juos, kad užbaigtumėte užduotį.",
          done: false,
          id: 31,
          code: 350737,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant vienos iš mašinų kabo lapas su brailio raštu. Iššifruokite brailio raštu parašytus skaičius ir įveskite juos, kad užbaigtumėte užduotį.",
          done: false,
          id: 32,
          code: 606584,
        },
        {
          task: "Raskite lapą su koordinatėmis pagrindinėje salėje ant sienos. Užduoties kodas - miestelio tose koordinatėse gyventojų skaičius (pagal Vikipediją) padauginta iš 188.",
          done: false,
          id: 33,
          code: 394424,
        },
        {
          task: "Raskite lapą su koordinatėmis antrame aukšte prie laiptų. Užduoties kodas - miestelio tose koordinatėse gyventojų skaičius (pagal Vikipediją) padauginta iš 1094.",
          done: false,
          id: 34,
          code: 476984,
        },
        {
          task: "Raskite lapą su koordinatėmis 5 kambario balkone. Užduoties kodas - miestelio tose koordinatėse gyventojų skaičius (pagal Vikipediją) padauginta iš 987.",
          done: false,
          id: 35,
          code: 733341,
        },
        {
          task: "Pasisverkite ant svarstyklių esančių 3 kambaryje ir užrasykite savo vardą bei svorį, kurį parodė svarstyklės lape esančiame prie svarstyklių. Atlikus užduotį, kodą gausite iš moderatoriaus.",
          done: false,
          id: 36,
          code: 849024,
        },
        {
          task: "Raskite paslėptą daiktą 2 kambaryje. Daiktas raudonos spalvos, labai lengvas ir iš plastiko. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 96489.",
          done: false,
          id: 37,
          code: 578934,
        },
        {
          task: "Raskite paslėptą daiktą virtuvėje. Daiktas žalios spalvos, šiltas ir minkštas. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 54698.",
          done: false,
          id: 38,
          code: 492282,
        },
        {
          task: "Raskite paslėptą daiktą 8 kambaryje. Daiktas mėlynos spalvos, popierinis. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 87456.",
          done: false,
          id: 39,
          code: 87456,
        },
        {
          task: "Apsirenkite šiltai. Raskite paslėptą daiktą prie vienos iš mašinų. Daiktas raudonos spalvos, pailgas. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 42013.",
          done: false,
          id: 40,
          code: 252078,
        },
      ];
      const hardTasks = [
        {
          task: "5 kambaryje ant sienos popieriaus lape rasite QR kodą, kuris jus nuves į vaizdo įrašą. Peržiūrėkite vaizdo įrašą ir raskite jame 6 skaičius, kurie ir bus užduoties kodas.",
          done: false,
          id: 41,
          code: 790363,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant vienos iš mašinų kabo lapas su užkoduotu žodžiu. Šifras, kuriuo užkoduotas žodis, nurodytas lape. Iššifruokite žodį. Užduoties kodas - žodžio ilgis pakeltas 8 laipsniu.",
          done: false,
          id: 42,
          code: 390625,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant namo sienos kabo lapas su užkoduotu žodžiu. Šifras, kuriuo užkoduotas žodis, nurodytas lape. Iššifruokite žodį. Užduoties kodas - žodžio ilgis pakeltas 5 laipsniu.",
          done: false,
          id: 43,
          code: 161051,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant akmeninės šašlykinės kabo lapas su užkoduotu žodžiu. Šifras, kuriuo užkoduotas žodis, nurodytas lape. Iššifruokite žodį. Užduoties kodas - žodžio ilgis pakeltas 11 laipsniu.",
          done: false,
          id: 44,
          code: 177147,
        },
        {
          task: "Paimkite plastmasinį bliudelį iš 7 kambario ir nuneškite jį moderatoriui į virtuvę. Moderatorius jums į bliudelį įdės lapelį. Tuomet nuneškite bliudelį su lapeliu viduje moderatoriui į 3 kambarį. Kai moderatorius 3 kambaryje įdės jums dar vieną lapelį, nuneškite bliudelį su abiem lapeliais viduje moderatoriui į pagrindinę salę prie stalo, kur gausite užduoties kodą.",
          done: false,
          id: 45,
          code: 719956,
        },
        {
          task: "Atspėkite dainą grojančią 9 kambaryje. Užduoties kodas - dainos atlikėjo ilgis pakeltas 5 laipsniu.",
          done: false,
          id: 46,
          code: 100000,
        },
        {
          task: "Paimkite popieriaus lapą 6 kambaryje su jame esančiu labirintu ir jį išsprendę pristatykite moderatoriui pagrindinėje salėje prie stalo, kad gautumėte užduoties kodą.",
          done: false,
          id: 47,
          code: 659504,
        },
        {
          task: "Pasiimkite popieriaus lapą su jame esančiu testu iš virtuvės ir su šalia esančiu tušinuku pažymėkite teisingus atsakymus teste. Kodas reikalingas išspręsti užduočiai - šalia teisingų variantų esantys skaičiai iš eilės. Išspręsta testą atiduokite kambaryje esančiam moderatoriui.",
          done: false,
          id: 48,
          code: 285597,
        },
      ];
      const easyTasks2 = [
        {
          task: "Pasiimkite popieriaus lapą su siluetu iš 1 kambario ir su šalia esančiais pieštukais užspalvinkite siluetą, panaudodami bent 2 skirtingų spalvų pieštukus. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite užspalvintą siluetą moderatoriui esančiam pagrindinėje salėje prie stalo.",
          done: false,
          id: 1,
          code: 937722,
        },
        {
          task: "Pasiimkite popieriaus lapą su siluetu iš 4 kambario ir su šalia esančiomis žirklėmis iškirpkite popieriuje esantį siluetą. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite iškirptą siluetą moderatoriui esančiam virtuvėje.",
          done: false,
          id: 2,
          code: 497152,
        },
        {
          task: "Pasiimkite tuščią popieriaus lapą iš 2 kambario ir su šalia esančiu tušinuku užrašykite visą lietuvišką abėcelę. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite lapą su jame užrašyta abėcele moderatoriui esančiam 3 kambaryje.",
          done: false,
          id: 3,
          code: 648438,
        },
        {
          task: "Pasiimkite tuščią popieriaus lapą iš 2 kambario ir su šalia esančiu tušinuku apipieškite savo kairę ranką. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite lapą su jame apibrėžta jūsų kaire ranka moderatoriui esančiam virtuvėje.",
          done: false,
          id: 4,
          code: 409546,
        },
        {
          task: "Pasiimkite tuščią popieriaus lapą iš 2 kambario ir išlankstykite iš jo lėktuvėlį. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite išlankstytą lėktuvėlį moderatoriui esančiam pagrindinėje salėje prie stalo.",
          done: false,
          id: 5,
          code: 897065,
        },
        {
          task: "Įmeskite kauliuką į puodelį virtuvėje iš 2 metrų atstumo. Įvykdžius užduotį kodą reikalingą užduočiai užbaigti jums duos moderatorius.",
          done: false,
          id: 6,
          code: 935744,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant įėjimo durų kabo lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 7,
          code: 996364,
        },
        {
          task: "Viduje prie išėjimo kabo lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 8,
          code: 226305,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant suoliuko prie šašlykinės guli lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 9,
          code: 843459,
        },
        {
          task: "Raskite lapą 7 kambaryje su nuoroda failo atsisiuntimui. Užduoties kodą rasite atsisiuntę ir atidarę failą.",
          done: false,
          id: 10,
          code: 942599,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke prie kairiojo įvažiavimo ant medžio su nuoroda failo atsisiuntimui. Užduoties kodą rasite atsisiuntę ir atidarę failą.",
          done: false,
          id: 11,
          code: 818088,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant medžio, esančio prie pastato, su nuoroda failo atsisiuntimui. Užduoties kodą rasite atsisiuntę ir atidarę failą.",
          done: false,
          id: 12,
          code: 961767,
        },
        {
          task: "Apsirenkite šiltai. Raskite paslėptą puodelį pavėsinėje, ant kurio yra užklijuotas užduoties kodas.",
          done: false,
          id: 13,
          code: 918217,
        },
        {
          task: "Apsirenkite šiltai. Raskite paslėptą puodelį lauke prie pastato, ant kurio yra užklijuotas užduoties kodas.",
          done: false,
          id: 14,
          code: 895446,
        },
        {
          task: "Raskite paslėptą puodelį 9 kambaryje, ant kurio yra užklijuotas užduoties kodas.",
          done: false,
          id: 15,
          code: 774747,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant pastato, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 16,
          code: 304306,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant vienos iš mašinų, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 17,
          code: 990507,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant vieno iš medžių kairiame įvažiavime, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 18,
          code: 375619,
        },
        {
          task: "Paimkite lapą iš virtuvės, ant kurio yra matematinė užduotis. Užduoties kodą gausite išsprendę užduotį.",
          done: false,
          id: 19,
          code: 526140,
        },
        {
          task: "Paimkite lapą iš 8 kambario, ant kurio yra matematinė užduotis. Užduoties kodą gausite išsprendę užduotį.",
          done: false,
          id: 20,
          code: 515255,
        },
        {
          task: "Paimkite lapą iš 6 kambario, ant kurio yra matematinė užduotis. Užduoties kodą gausite išsprendę užduotį.",
          done: false,
          id: 21,
          code: 171023,
        },
        {
          task: "7 kambaryje rasite daug užverstų lapų. Atvertinėkite lapus, tol kol rasite ant vieno iš jų parašytą užduoties kodą. Nepamirškite įvykdę užduotį užversti lapų atgal.",
          done: false,
          id: 22,
          code: 791335,
        },
        {
          task: "5 kambaryje kabo lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 23,
          code: 841671,
        },
        {
          task: "Raskite lapą 5 kambaryje, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 24,
          code: 746019,
        },
      ];
      const mediumTasks2 = [
        {
          task: "Pasiimkite popieriaus lapą su jame esančiu testu iš 3 kambario ir su šalia esančiu tušinuku pažymėkite teisingus atsakymus teste. Kodas reikalingas išspręsti užduočiai - šalia teisingų variantų esantys skaičiai iš eilės. Išspręsta testą atiduokite kambaryje esančiam moderatoriui.",
          done: false,
          id: 25,
          code: 655039,
        },
        {
          task: "Apsirenkite šiltai. Pripūskite ir susprogdinkite balioną, kuris yra pririštas prie pavėsinės. Užduoties kodas - baliono viduje.",
          done: false,
          id: 26,
          code: 899421,
        },
        {
          task: "Sujunkite laidus pagal spalvas 2 kambaryje. Užduoties kodas - sudėkite mėlyno laido pradžios poziciją ir raudono laido pabaigos poziciją ir gautą skaičių pakelkite 9 laipsniu. Įvykdžius užduotį laidus atjunkite.",
          done: false,
          id: 27,
          code: 262144,
        },
        {
          task: "Sujunkite laidus pagal spalvas 4 kambaryje. Užduoties kodas - sudėkite geltono laido pradžios poziciją ir geltono laido pabaigos poziciją ir gautą skaičių pakelkite 7 laipsniu. Įvykdžius užduotį laidus atjunkite.",
          done: false,
          id: 28,
          code: 279936,
        },
        {
          task: "Sujunkite laidus pagal spalvas 5 kambaryje. Užduoties kodas - sudėkite rožinio laido pradžios poziciją ir mėlyno laido pabaigos poziciją ir gautą skaičių pakelkite 12 laipsniu. Įvykdžius užduotį laidus atjunkite.",
          done: false,
          id: 29,
          code: 531441,
        },
        {
          task: "Apsirenkite šiltai. Lauke prie dešiniojo įvažiavimo į sodybą ant vieno iš medžių kabo lapas su brailio raštu. Iššifruokite brailio raštu parašytus skaičius ir įveskite juos, kad užbaigtumėte užduotį.",
          done: false,
          id: 30,
          code: 485736,
        },
        {
          task: "Apsirenkite šiltai. Lauke prie pavesinės ant medžio kabo lapas su brailio raštu. Iššifruokite brailio raštu parašytus skaičius ir įveskite juos, kad užbaigtumėte užduotį.",
          done: false,
          id: 31,
          code: 350737,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant vienos iš mašinų kabo lapas su brailio raštu. Iššifruokite brailio raštu parašytus skaičius ir įveskite juos, kad užbaigtumėte užduotį.",
          done: false,
          id: 32,
          code: 606584,
        },
        {
          task: "Raskite lapą su koordinatėmis pagrindinėje salėje ant sienos. Užduoties kodas - miestelio tose koordinatėse gyventojų skaičius (pagal Vikipediją) padauginta iš 188.",
          done: false,
          id: 33,
          code: 394424,
        },
        {
          task: "Raskite lapą su koordinatėmis antrame aukšte prie laiptų. Užduoties kodas - miestelio tose koordinatėse gyventojų skaičius (pagal Vikipediją) padauginta iš 1094.",
          done: false,
          id: 34,
          code: 476984,
        },
        {
          task: "Raskite lapą su koordinatėmis 5 kambario balkone. Užduoties kodas - miestelio tose koordinatėse gyventojų skaičius (pagal Vikipediją) padauginta iš 987.",
          done: false,
          id: 35,
          code: 733341,
        },
        {
          task: "Pasisverkite ant svarstyklių esančių 3 kambaryje ir užrasykite savo vardą bei svorį, kurį parodė svarstyklės lape esančiame prie svarstyklių. Atlikus užduotį, kodą gausite iš moderatoriaus.",
          done: false,
          id: 36,
          code: 849024,
        },
        {
          task: "Raskite paslėptą daiktą 2 kambaryje. Daiktas raudonos spalvos, labai lengvas ir iš plastiko. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 96489.",
          done: false,
          id: 37,
          code: 578934,
        },
        {
          task: "Raskite paslėptą daiktą virtuvėje. Daiktas žalios spalvos, šiltas ir minkštas. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 54698.",
          done: false,
          id: 38,
          code: 492282,
        },
        {
          task: "Raskite paslėptą daiktą 8 kambaryje. Daiktas mėlynos spalvos, popierinis. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 87456.",
          done: false,
          id: 39,
          code: 87456,
        },
        {
          task: "Apsirenkite šiltai. Raskite paslėptą daiktą prie vienos iš mašinų. Daiktas raudonos spalvos, pailgas. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 42013.",
          done: false,
          id: 40,
          code: 252078,
        },
      ];
      const hardTasks2 = [
        {
          task: "5 kambaryje ant sienos popieriaus lape rasite QR kodą, kuris jus nuves į vaizdo įrašą. Peržiūrėkite vaizdo įrašą ir raskite jame 6 skaičius, kurie ir bus užduoties kodas.",
          done: false,
          id: 41,
          code: 790363,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant vienos iš mašinų kabo lapas su užkoduotu žodžiu. Šifras, kuriuo užkoduotas žodis, nurodytas lape. Iššifruokite žodį. Užduoties kodas - žodžio ilgis pakeltas 8 laipsniu.",
          done: false,
          id: 42,
          code: 390625,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant namo sienos kabo lapas su užkoduotu žodžiu. Šifras, kuriuo užkoduotas žodis, nurodytas lape. Iššifruokite žodį. Užduoties kodas - žodžio ilgis pakeltas 5 laipsniu.",
          done: false,
          id: 43,
          code: 161051,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant akmeninės šašlykinės kabo lapas su užkoduotu žodžiu. Šifras, kuriuo užkoduotas žodis, nurodytas lape. Iššifruokite žodį. Užduoties kodas - žodžio ilgis pakeltas 11 laipsniu.",
          done: false,
          id: 44,
          code: 177147,
        },
        {
          task: "Paimkite plastmasinį bliudelį iš 7 kambario ir nuneškite jį moderatoriui į virtuvę. Moderatorius jums į bliudelį įdės lapelį. Tuomet nuneškite bliudelį su lapeliu viduje moderatoriui į 3 kambarį. Kai moderatorius 3 kambaryje įdės jums dar vieną lapelį, nuneškite bliudelį su abiem lapeliais viduje moderatoriui į pagrindinę salę prie stalo, kur gausite užduoties kodą.",
          done: false,
          id: 45,
          code: 719956,
        },
        {
          task: "Atspėkite dainą grojančią 9 kambaryje. Užduoties kodas - dainos atlikėjo ilgis pakeltas 5 laipsniu.",
          done: false,
          id: 46,
          code: 100000,
        },
        {
          task: "Paimkite popieriaus lapą 6 kambaryje su jame esančiu labirintu ir jį išsprendę pristatykite moderatoriui pagrindinėje salėje prie stalo, kad gautumėte užduoties kodą.",
          done: false,
          id: 47,
          code: 659504,
        },
        {
          task: "Pasiimkite popieriaus lapą su jame esančiu testu iš virtuvės ir su šalia esančiu tušinuku pažymėkite teisingus atsakymus teste. Kodas reikalingas išspręsti užduočiai - šalia teisingų variantų esantys skaičiai iš eilės. Išspręsta testą atiduokite kambaryje esančiam moderatoriui.",
          done: false,
          id: 48,
          code: 285597,
        },
      ];
      const easyTasks3 = [
        {
          task: "Pasiimkite popieriaus lapą su siluetu iš 1 kambario ir su šalia esančiais pieštukais užspalvinkite siluetą, panaudodami bent 2 skirtingų spalvų pieštukus. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite užspalvintą siluetą moderatoriui esančiam pagrindinėje salėje prie stalo.",
          done: false,
          id: 1,
          code: 937722,
        },
        {
          task: "Pasiimkite popieriaus lapą su siluetu iš 4 kambario ir su šalia esančiomis žirklėmis iškirpkite popieriuje esantį siluetą. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite iškirptą siluetą moderatoriui esančiam virtuvėje.",
          done: false,
          id: 2,
          code: 497152,
        },
        {
          task: "Pasiimkite tuščią popieriaus lapą iš 2 kambario ir su šalia esančiu tušinuku užrašykite visą lietuvišką abėcelę. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite lapą su jame užrašyta abėcele moderatoriui esančiam 3 kambaryje.",
          done: false,
          id: 3,
          code: 648438,
        },
        {
          task: "Pasiimkite tuščią popieriaus lapą iš 2 kambario ir su šalia esančiu tušinuku apipieškite savo kairę ranką. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite lapą su jame apibrėžta jūsų kaire ranka moderatoriui esančiam virtuvėje.",
          done: false,
          id: 4,
          code: 409546,
        },
        {
          task: "Pasiimkite tuščią popieriaus lapą iš 2 kambario ir išlankstykite iš jo lėktuvėlį. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite išlankstytą lėktuvėlį moderatoriui esančiam pagrindinėje salėje prie stalo.",
          done: false,
          id: 5,
          code: 897065,
        },
        {
          task: "Įmeskite kauliuką į puodelį virtuvėje iš 2 metrų atstumo. Įvykdžius užduotį kodą reikalingą užduočiai užbaigti jums duos moderatorius.",
          done: false,
          id: 6,
          code: 935744,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant įėjimo durų kabo lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 7,
          code: 996364,
        },
        {
          task: "Viduje prie išėjimo kabo lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 8,
          code: 226305,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant suoliuko prie šašlykinės guli lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 9,
          code: 843459,
        },
        {
          task: "Raskite lapą 7 kambaryje su nuoroda failo atsisiuntimui. Užduoties kodą rasite atsisiuntę ir atidarę failą.",
          done: false,
          id: 10,
          code: 942599,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke prie kairiojo įvažiavimo ant medžio su nuoroda failo atsisiuntimui. Užduoties kodą rasite atsisiuntę ir atidarę failą.",
          done: false,
          id: 11,
          code: 818088,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant medžio, esančio prie pastato, su nuoroda failo atsisiuntimui. Užduoties kodą rasite atsisiuntę ir atidarę failą.",
          done: false,
          id: 12,
          code: 961767,
        },
        {
          task: "Apsirenkite šiltai. Raskite paslėptą puodelį pavėsinėje, ant kurio yra užklijuotas užduoties kodas.",
          done: false,
          id: 13,
          code: 918217,
        },
        {
          task: "Apsirenkite šiltai. Raskite paslėptą puodelį lauke prie pastato, ant kurio yra užklijuotas užduoties kodas.",
          done: false,
          id: 14,
          code: 895446,
        },
        {
          task: "Raskite paslėptą puodelį 9 kambaryje, ant kurio yra užklijuotas užduoties kodas.",
          done: false,
          id: 15,
          code: 774747,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant pastato, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 16,
          code: 304306,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant vienos iš mašinų, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 17,
          code: 990507,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant vieno iš medžių kairiame įvažiavime, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 18,
          code: 375619,
        },
        {
          task: "Paimkite lapą iš virtuvės, ant kurio yra matematinė užduotis. Užduoties kodą gausite išsprendę užduotį.",
          done: false,
          id: 19,
          code: 526140,
        },
        {
          task: "Paimkite lapą iš 8 kambario, ant kurio yra matematinė užduotis. Užduoties kodą gausite išsprendę užduotį.",
          done: false,
          id: 20,
          code: 515255,
        },
        {
          task: "Paimkite lapą iš 6 kambario, ant kurio yra matematinė užduotis. Užduoties kodą gausite išsprendę užduotį.",
          done: false,
          id: 21,
          code: 171023,
        },
        {
          task: "7 kambaryje rasite daug užverstų lapų. Atvertinėkite lapus, tol kol rasite ant vieno iš jų parašytą užduoties kodą. Nepamirškite įvykdę užduotį užversti lapų atgal.",
          done: false,
          id: 22,
          code: 791335,
        },
        {
          task: "5 kambaryje kabo lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 23,
          code: 841671,
        },
        {
          task: "Raskite lapą 5 kambaryje, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 24,
          code: 746019,
        },
      ];
      const mediumTasks3 = [
        {
          task: "Pasiimkite popieriaus lapą su jame esančiu testu iš 3 kambario ir su šalia esančiu tušinuku pažymėkite teisingus atsakymus teste. Kodas reikalingas išspręsti užduočiai - šalia teisingų variantų esantys skaičiai iš eilės. Išspręsta testą atiduokite kambaryje esančiam moderatoriui.",
          done: false,
          id: 25,
          code: 655039,
        },
        {
          task: "Apsirenkite šiltai. Pripūskite ir susprogdinkite balioną, kuris yra pririštas prie pavėsinės. Užduoties kodas - baliono viduje.",
          done: false,
          id: 26,
          code: 899421,
        },
        {
          task: "Sujunkite laidus pagal spalvas 2 kambaryje. Užduoties kodas - sudėkite mėlyno laido pradžios poziciją ir raudono laido pabaigos poziciją ir gautą skaičių pakelkite 9 laipsniu. Įvykdžius užduotį laidus atjunkite.",
          done: false,
          id: 27,
          code: 262144,
        },
        {
          task: "Sujunkite laidus pagal spalvas 4 kambaryje. Užduoties kodas - sudėkite geltono laido pradžios poziciją ir geltono laido pabaigos poziciją ir gautą skaičių pakelkite 7 laipsniu. Įvykdžius užduotį laidus atjunkite.",
          done: false,
          id: 28,
          code: 279936,
        },
        {
          task: "Sujunkite laidus pagal spalvas 5 kambaryje. Užduoties kodas - sudėkite rožinio laido pradžios poziciją ir mėlyno laido pabaigos poziciją ir gautą skaičių pakelkite 12 laipsniu. Įvykdžius užduotį laidus atjunkite.",
          done: false,
          id: 29,
          code: 531441,
        },
        {
          task: "Apsirenkite šiltai. Lauke prie dešiniojo įvažiavimo į sodybą ant vieno iš medžių kabo lapas su brailio raštu. Iššifruokite brailio raštu parašytus skaičius ir įveskite juos, kad užbaigtumėte užduotį.",
          done: false,
          id: 30,
          code: 485736,
        },
        {
          task: "Apsirenkite šiltai. Lauke prie pavesinės ant medžio kabo lapas su brailio raštu. Iššifruokite brailio raštu parašytus skaičius ir įveskite juos, kad užbaigtumėte užduotį.",
          done: false,
          id: 31,
          code: 350737,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant vienos iš mašinų kabo lapas su brailio raštu. Iššifruokite brailio raštu parašytus skaičius ir įveskite juos, kad užbaigtumėte užduotį.",
          done: false,
          id: 32,
          code: 606584,
        },
        {
          task: "Raskite lapą su koordinatėmis pagrindinėje salėje ant sienos. Užduoties kodas - miestelio tose koordinatėse gyventojų skaičius (pagal Vikipediją) padauginta iš 188.",
          done: false,
          id: 33,
          code: 394424,
        },
        {
          task: "Raskite lapą su koordinatėmis antrame aukšte prie laiptų. Užduoties kodas - miestelio tose koordinatėse gyventojų skaičius (pagal Vikipediją) padauginta iš 1094.",
          done: false,
          id: 34,
          code: 476984,
        },
        {
          task: "Raskite lapą su koordinatėmis 5 kambario balkone. Užduoties kodas - miestelio tose koordinatėse gyventojų skaičius (pagal Vikipediją) padauginta iš 987.",
          done: false,
          id: 35,
          code: 733341,
        },
        {
          task: "Pasisverkite ant svarstyklių esančių 3 kambaryje ir užrasykite savo vardą bei svorį, kurį parodė svarstyklės lape esančiame prie svarstyklių. Atlikus užduotį, kodą gausite iš moderatoriaus.",
          done: false,
          id: 36,
          code: 849024,
        },
        {
          task: "Raskite paslėptą daiktą 2 kambaryje. Daiktas raudonos spalvos, labai lengvas ir iš plastiko. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 96489.",
          done: false,
          id: 37,
          code: 578934,
        },
        {
          task: "Raskite paslėptą daiktą virtuvėje. Daiktas žalios spalvos, šiltas ir minkštas. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 54698.",
          done: false,
          id: 38,
          code: 492282,
        },
        {
          task: "Raskite paslėptą daiktą 8 kambaryje. Daiktas mėlynos spalvos, popierinis. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 87456.",
          done: false,
          id: 39,
          code: 87456,
        },
        {
          task: "Apsirenkite šiltai. Raskite paslėptą daiktą prie vienos iš mašinų. Daiktas raudonos spalvos, pailgas. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 42013.",
          done: false,
          id: 40,
          code: 252078,
        },
      ];
      const hardTasks3 = [
        {
          task: "5 kambaryje ant sienos popieriaus lape rasite QR kodą, kuris jus nuves į vaizdo įrašą. Peržiūrėkite vaizdo įrašą ir raskite jame 6 skaičius, kurie ir bus užduoties kodas.",
          done: false,
          id: 41,
          code: 790363,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant vienos iš mašinų kabo lapas su užkoduotu žodžiu. Šifras, kuriuo užkoduotas žodis, nurodytas lape. Iššifruokite žodį. Užduoties kodas - žodžio ilgis pakeltas 8 laipsniu.",
          done: false,
          id: 42,
          code: 390625,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant namo sienos kabo lapas su užkoduotu žodžiu. Šifras, kuriuo užkoduotas žodis, nurodytas lape. Iššifruokite žodį. Užduoties kodas - žodžio ilgis pakeltas 5 laipsniu.",
          done: false,
          id: 43,
          code: 161051,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant akmeninės šašlykinės kabo lapas su užkoduotu žodžiu. Šifras, kuriuo užkoduotas žodis, nurodytas lape. Iššifruokite žodį. Užduoties kodas - žodžio ilgis pakeltas 11 laipsniu.",
          done: false,
          id: 44,
          code: 177147,
        },
        {
          task: "Paimkite plastmasinį bliudelį iš 7 kambario ir nuneškite jį moderatoriui į virtuvę. Moderatorius jums į bliudelį įdės lapelį. Tuomet nuneškite bliudelį su lapeliu viduje moderatoriui į 3 kambarį. Kai moderatorius 3 kambaryje įdės jums dar vieną lapelį, nuneškite bliudelį su abiem lapeliais viduje moderatoriui į pagrindinę salę prie stalo, kur gausite užduoties kodą.",
          done: false,
          id: 45,
          code: 719956,
        },
        {
          task: "Atspėkite dainą grojančią 9 kambaryje. Užduoties kodas - dainos atlikėjo ilgis pakeltas 5 laipsniu.",
          done: false,
          id: 46,
          code: 100000,
        },
        {
          task: "Paimkite popieriaus lapą 6 kambaryje su jame esančiu labirintu ir jį išsprendę pristatykite moderatoriui pagrindinėje salėje prie stalo, kad gautumėte užduoties kodą.",
          done: false,
          id: 47,
          code: 659504,
        },
        {
          task: "Pasiimkite popieriaus lapą su jame esančiu testu iš virtuvės ir su šalia esančiu tušinuku pažymėkite teisingus atsakymus teste. Kodas reikalingas išspręsti užduočiai - šalia teisingų variantų esantys skaičiai iš eilės. Išspręsta testą atiduokite kambaryje esančiam moderatoriui.",
          done: false,
          id: 48,
          code: 285597,
        },
      ];
      const easyTasks4 = [
        {
          task: "Pasiimkite popieriaus lapą su siluetu iš 1 kambario ir su šalia esančiais pieštukais užspalvinkite siluetą, panaudodami bent 2 skirtingų spalvų pieštukus. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite užspalvintą siluetą moderatoriui esančiam pagrindinėje salėje prie stalo.",
          done: false,
          id: 1,
          code: 937722,
        },
        {
          task: "Pasiimkite popieriaus lapą su siluetu iš 4 kambario ir su šalia esančiomis žirklėmis iškirpkite popieriuje esantį siluetą. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite iškirptą siluetą moderatoriui esančiam virtuvėje.",
          done: false,
          id: 2,
          code: 497152,
        },
        {
          task: "Pasiimkite tuščią popieriaus lapą iš 2 kambario ir su šalia esančiu tušinuku užrašykite visą lietuvišką abėcelę. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite lapą su jame užrašyta abėcele moderatoriui esančiam 3 kambaryje.",
          done: false,
          id: 3,
          code: 648438,
        },
        {
          task: "Pasiimkite tuščią popieriaus lapą iš 2 kambario ir su šalia esančiu tušinuku apipieškite savo kairę ranką. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite lapą su jame apibrėžta jūsų kaire ranka moderatoriui esančiam virtuvėje.",
          done: false,
          id: 4,
          code: 409546,
        },
        {
          task: "Pasiimkite tuščią popieriaus lapą iš 2 kambario ir išlankstykite iš jo lėktuvėlį. Norint gauti kodą reikalingą užbaigti šiai užduočiai, pristatykite išlankstytą lėktuvėlį moderatoriui esančiam pagrindinėje salėje prie stalo.",
          done: false,
          id: 5,
          code: 897065,
        },
        {
          task: "Įmeskite kauliuką į puodelį virtuvėje iš 2 metrų atstumo. Įvykdžius užduotį kodą reikalingą užduočiai užbaigti jums duos moderatorius.",
          done: false,
          id: 6,
          code: 935744,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant įėjimo durų kabo lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 7,
          code: 996364,
        },
        {
          task: "Viduje prie išėjimo kabo lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 8,
          code: 226305,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant suoliuko prie šašlykinės guli lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 9,
          code: 843459,
        },
        {
          task: "Raskite lapą 7 kambaryje su nuoroda failo atsisiuntimui. Užduoties kodą rasite atsisiuntę ir atidarę failą.",
          done: false,
          id: 10,
          code: 942599,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke prie kairiojo įvažiavimo ant medžio su nuoroda failo atsisiuntimui. Užduoties kodą rasite atsisiuntę ir atidarę failą.",
          done: false,
          id: 11,
          code: 818088,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant medžio, esančio prie pastato, su nuoroda failo atsisiuntimui. Užduoties kodą rasite atsisiuntę ir atidarę failą.",
          done: false,
          id: 12,
          code: 961767,
        },
        {
          task: "Apsirenkite šiltai. Raskite paslėptą puodelį pavėsinėje, ant kurio yra užklijuotas užduoties kodas.",
          done: false,
          id: 13,
          code: 918217,
        },
        {
          task: "Apsirenkite šiltai. Raskite paslėptą puodelį lauke prie pastato, ant kurio yra užklijuotas užduoties kodas.",
          done: false,
          id: 14,
          code: 895446,
        },
        {
          task: "Raskite paslėptą puodelį 9 kambaryje, ant kurio yra užklijuotas užduoties kodas.",
          done: false,
          id: 15,
          code: 774747,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant pastato, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 16,
          code: 304306,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant vienos iš mašinų, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 17,
          code: 990507,
        },
        {
          task: "Apsirenkite šiltai. Raskite lapą lauke ant vieno iš medžių kairiame įvažiavime, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 18,
          code: 375619,
        },
        {
          task: "Paimkite lapą iš virtuvės, ant kurio yra matematinė užduotis. Užduoties kodą gausite išsprendę užduotį.",
          done: false,
          id: 19,
          code: 526140,
        },
        {
          task: "Paimkite lapą iš 8 kambario, ant kurio yra matematinė užduotis. Užduoties kodą gausite išsprendę užduotį.",
          done: false,
          id: 20,
          code: 515255,
        },
        {
          task: "Paimkite lapą iš 6 kambario, ant kurio yra matematinė užduotis. Užduoties kodą gausite išsprendę užduotį.",
          done: false,
          id: 21,
          code: 171023,
        },
        {
          task: "7 kambaryje rasite daug užverstų lapų. Atvertinėkite lapus, tol kol rasite ant vieno iš jų parašytą užduoties kodą. Nepamirškite įvykdę užduotį užversti lapų atgal.",
          done: false,
          id: 22,
          code: 791335,
        },
        {
          task: "5 kambaryje kabo lapas su QR kodu. Nuskaitykite QR kodą, kad gautumėte užduočiai užbaigti reikalingą kodą.",
          done: false,
          id: 23,
          code: 841671,
        },
        {
          task: "Raskite lapą 5 kambaryje, ant kurio yra nuoroda. Nuorodoje rasite užduoties kodą.",
          done: false,
          id: 24,
          code: 746019,
        },
      ];
      const mediumTasks4 = [
        {
          task: "Pasiimkite popieriaus lapą su jame esančiu testu iš 3 kambario ir su šalia esančiu tušinuku pažymėkite teisingus atsakymus teste. Kodas reikalingas išspręsti užduočiai - šalia teisingų variantų esantys skaičiai iš eilės. Išspręsta testą atiduokite kambaryje esančiam moderatoriui.",
          done: false,
          id: 25,
          code: 655039,
        },
        {
          task: "Apsirenkite šiltai. Pripūskite ir susprogdinkite balioną, kuris yra pririštas prie pavėsinės. Užduoties kodas - baliono viduje.",
          done: false,
          id: 26,
          code: 899421,
        },
        {
          task: "Sujunkite laidus pagal spalvas 2 kambaryje. Užduoties kodas - sudėkite mėlyno laido pradžios poziciją ir raudono laido pabaigos poziciją ir gautą skaičių pakelkite 9 laipsniu. Įvykdžius užduotį laidus atjunkite.",
          done: false,
          id: 27,
          code: 262144,
        },
        {
          task: "Sujunkite laidus pagal spalvas 4 kambaryje. Užduoties kodas - sudėkite geltono laido pradžios poziciją ir geltono laido pabaigos poziciją ir gautą skaičių pakelkite 7 laipsniu. Įvykdžius užduotį laidus atjunkite.",
          done: false,
          id: 28,
          code: 279936,
        },
        {
          task: "Sujunkite laidus pagal spalvas 5 kambaryje. Užduoties kodas - sudėkite rožinio laido pradžios poziciją ir mėlyno laido pabaigos poziciją ir gautą skaičių pakelkite 12 laipsniu. Įvykdžius užduotį laidus atjunkite.",
          done: false,
          id: 29,
          code: 531441,
        },
        {
          task: "Apsirenkite šiltai. Lauke prie dešiniojo įvažiavimo į sodybą ant vieno iš medžių kabo lapas su brailio raštu. Iššifruokite brailio raštu parašytus skaičius ir įveskite juos, kad užbaigtumėte užduotį.",
          done: false,
          id: 30,
          code: 485736,
        },
        {
          task: "Apsirenkite šiltai. Lauke prie pavesinės ant medžio kabo lapas su brailio raštu. Iššifruokite brailio raštu parašytus skaičius ir įveskite juos, kad užbaigtumėte užduotį.",
          done: false,
          id: 31,
          code: 350737,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant vienos iš mašinų kabo lapas su brailio raštu. Iššifruokite brailio raštu parašytus skaičius ir įveskite juos, kad užbaigtumėte užduotį.",
          done: false,
          id: 32,
          code: 606584,
        },
        {
          task: "Raskite lapą su koordinatėmis pagrindinėje salėje ant sienos. Užduoties kodas - miestelio tose koordinatėse gyventojų skaičius (pagal Vikipediją) padauginta iš 188.",
          done: false,
          id: 33,
          code: 394424,
        },
        {
          task: "Raskite lapą su koordinatėmis antrame aukšte prie laiptų. Užduoties kodas - miestelio tose koordinatėse gyventojų skaičius (pagal Vikipediją) padauginta iš 1094.",
          done: false,
          id: 34,
          code: 476984,
        },
        {
          task: "Raskite lapą su koordinatėmis 5 kambario balkone. Užduoties kodas - miestelio tose koordinatėse gyventojų skaičius (pagal Vikipediją) padauginta iš 987.",
          done: false,
          id: 35,
          code: 733341,
        },
        {
          task: "Pasisverkite ant svarstyklių esančių 3 kambaryje ir užrasykite savo vardą bei svorį, kurį parodė svarstyklės lape esančiame prie svarstyklių. Atlikus užduotį, kodą gausite iš moderatoriaus.",
          done: false,
          id: 36,
          code: 849024,
        },
        {
          task: "Raskite paslėptą daiktą 2 kambaryje. Daiktas raudonos spalvos, labai lengvas ir iš plastiko. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 96489.",
          done: false,
          id: 37,
          code: 578934,
        },
        {
          task: "Raskite paslėptą daiktą virtuvėje. Daiktas žalios spalvos, šiltas ir minkštas. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 54698.",
          done: false,
          id: 38,
          code: 492282,
        },
        {
          task: "Raskite paslėptą daiktą 8 kambaryje. Daiktas mėlynos spalvos, popierinis. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 87456.",
          done: false,
          id: 39,
          code: 87456,
        },
        {
          task: "Apsirenkite šiltai. Raskite paslėptą daiktą prie vienos iš mašinų. Daiktas raudonos spalvos, pailgas. Užduoties kodas - daikto pavadinimo ilgis padaugintas iš 42013.",
          done: false,
          id: 40,
          code: 252078,
        },
      ];
      const hardTasks4 = [
        {
          task: "5 kambaryje ant sienos popieriaus lape rasite QR kodą, kuris jus nuves į vaizdo įrašą. Peržiūrėkite vaizdo įrašą ir raskite jame 6 skaičius, kurie ir bus užduoties kodas.",
          done: false,
          id: 41,
          code: 790363,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant vienos iš mašinų kabo lapas su užkoduotu žodžiu. Šifras, kuriuo užkoduotas žodis, nurodytas lape. Iššifruokite žodį. Užduoties kodas - žodžio ilgis pakeltas 8 laipsniu.",
          done: false,
          id: 42,
          code: 390625,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant namo sienos kabo lapas su užkoduotu žodžiu. Šifras, kuriuo užkoduotas žodis, nurodytas lape. Iššifruokite žodį. Užduoties kodas - žodžio ilgis pakeltas 5 laipsniu.",
          done: false,
          id: 43,
          code: 161051,
        },
        {
          task: "Apsirenkite šiltai. Lauke ant akmeninės šašlykinės kabo lapas su užkoduotu žodžiu. Šifras, kuriuo užkoduotas žodis, nurodytas lape. Iššifruokite žodį. Užduoties kodas - žodžio ilgis pakeltas 11 laipsniu.",
          done: false,
          id: 44,
          code: 177147,
        },
        {
          task: "Paimkite plastmasinį bliudelį iš 7 kambario ir nuneškite jį moderatoriui į virtuvę. Moderatorius jums į bliudelį įdės lapelį. Tuomet nuneškite bliudelį su lapeliu viduje moderatoriui į 3 kambarį. Kai moderatorius 3 kambaryje įdės jums dar vieną lapelį, nuneškite bliudelį su abiem lapeliais viduje moderatoriui į pagrindinę salę prie stalo, kur gausite užduoties kodą.",
          done: false,
          id: 45,
          code: 719956,
        },
        {
          task: "Atspėkite dainą grojančią 9 kambaryje. Užduoties kodas - dainos atlikėjo ilgis pakeltas 5 laipsniu.",
          done: false,
          id: 46,
          code: 100000,
        },
        {
          task: "Paimkite popieriaus lapą 6 kambaryje su jame esančiu labirintu ir jį išsprendę pristatykite moderatoriui pagrindinėje salėje prie stalo, kad gautumėte užduoties kodą.",
          done: false,
          id: 47,
          code: 659504,
        },
        {
          task: "Pasiimkite popieriaus lapą su jame esančiu testu iš virtuvės ir su šalia esančiu tušinuku pažymėkite teisingus atsakymus teste. Kodas reikalingas išspręsti užduočiai - šalia teisingų variantų esantys skaičiai iš eilės. Išspręsta testą atiduokite kambaryje esančiam moderatoriui.",
          done: false,
          id: 48,
          code: 285597,
        },
      ];
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
      const allPlayers = await playersRef.get();
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
        // ready: false,
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
      });
    });
    await batch.commit();
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
            </>
          )}
        </Flex>
      ) : (
        <Box px={3}>
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
  };
  const [playerName, setPlayerName] = useState(name);
  const handlePlayerNameChange = (e: any) => setPlayerName(e.target.value);
  const onChangePlayerName = async () => {
    await currentPlayerRef.update({
      name: playerName,
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
    onKickPlayerClose();
    if (aliveImposters?.length >= aliveCrewmates?.length - 1) {
      const batch = firestore.batch();
      const allPlayers = await playersRef.get();
      allPlayers.forEach((doc) => {
        batch.update(playersRef.doc(doc.id), {
          win: "imposters",
        });
      });
      await batch.commit();
      setImpostersWin(true);
    } else if (aliveImposters?.length === 0) {
      const batch = firestore.batch();
      const allPlayers = await playersRef.get();
      allPlayers.forEach((doc) => {
        batch.update(playersRef.doc(doc.id), {
          win: "crewmates",
        });
      });
      await batch.commit();
      setCrewmatesWin(true);
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
    onVotePlayerClose();
    if (aliveImposters?.length >= aliveCrewmates?.length - 1) {
      const batch = firestore.batch();
      const allPlayers = await playersRef.get();
      allPlayers.forEach((doc) => {
        batch.update(playersRef.doc(doc.id), {
          win: "imposters",
        });
      });
      await batch.commit();
      setImpostersWin(true);
    } else if (aliveImposters?.length === 0) {
      const batch = firestore.batch();
      const allPlayers = await playersRef.get();
      allPlayers.forEach((doc) => {
        batch.update(playersRef.doc(doc.id), {
          win: "crewmates",
        });
      });
      await batch.commit();
      setCrewmatesWin(true);
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
    onVotePlayerClose();
    if (aliveImposters?.length === 0) {
      const batch = firestore.batch();
      const allPlayers = await playersRef.get();
      allPlayers.forEach((doc) => {
        batch.update(playersRef.doc(doc.id), {
          win: "crewmates",
        });
      });
      await batch.commit();
      setCrewmatesWin(true);
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
            currentPlayer?.data().isMeetingStarted && (
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
