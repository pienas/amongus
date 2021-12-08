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
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { EditIcon } from "@chakra-ui/icons";
import { useState, useEffect } from "react";

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
          screenHidden: false,
          role: "player",
          win: "",
        });
    });
  };
  return <button onClick={signInWithGoogle}>Prisijungti</button>;
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
  const [screenHidden, setScreenHidden] = useState(false);
  const [screenHiding, setScreenHiding] = useState(false);
  const [crewmatesWin, setCrewmatesWin] = useState(false);
  const [impostersWin, setImpostersWin] = useState(false);
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
      setScreenHidden(currentPlayer.screenHidden);
      setIsCurrentPlayerAdmin(currentPlayer.role === "admin" ? true : false);
      setCrewmatesWin(currentPlayer.win === "crewmates");
      setImpostersWin(currentPlayer.win === "imposters");
    } else {
      setGameStarted(false);
      setScreenHidden(false);
      setIsCurrentPlayerAdmin(false);
      setCrewmatesWin(false);
      setImpostersWin(false);
    }
  }, [currentPlayer]);
  if (
    !players ||
    !playersReady ||
    !currentPlayer ||
    !playersInGame ||
    !allPlayers
  ) {
    return <Box>Kraunama...</Box>;
  }
  const completeEasyTask = async (id: number) => {
    const playerRef = firestore
      .collection("players")
      .doc(auth.currentUser?.uid);
    const tasks = currentPlayer.easyTasks;
    tasks[tasks.findIndex((task: any) => task.id === id)].done = true;
    await playerRef.update({
      easyTasks: tasks,
    });
    if ((doneTasks() / ((players.length - 7) * 10)) * 100 === 100) {
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
    });
    if ((doneTasks() / ((players.length - 7) * 10)) * 100 === 100) {
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
    });
    if ((doneTasks() / ((players.length - 7) * 10)) * 100 === 100) {
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
    } else {
      const batch = firestore.batch();
      setGameStarting(true);
      const easyTasks = [
        { task: "Test1", done: false, id: 1 },
        { task: "Test2", done: false, id: 2 },
        { task: "Test3", done: false, id: 3 },
        { task: "Test4", done: false, id: 4 },
        { task: "Test5", done: false, id: 5 },
        { task: "Test6", done: false, id: 6 },
        { task: "Test7", done: false, id: 7 },
        { task: "Test8", done: false, id: 8 },
        { task: "Test9", done: false, id: 9 },
        { task: "Test10", done: false, id: 10 },
      ];
      const mediumTasks = [
        { task: "Test1", done: false, id: 11 },
        { task: "Test2", done: false, id: 12 },
        { task: "Test3", done: false, id: 13 },
        { task: "Test4", done: false, id: 14 },
        { task: "Test5", done: false, id: 15 },
        { task: "Test6", done: false, id: 16 },
        { task: "Test7", done: false, id: 17 },
        { task: "Test8", done: false, id: 18 },
        { task: "Test9", done: false, id: 19 },
        { task: "Test10", done: false, id: 20 },
      ];
      const hardTasks = [
        { task: "Test1", done: false, id: 21 },
        { task: "Test2", done: false, id: 22 },
        { task: "Test3", done: false, id: 23 },
        { task: "Test4", done: false, id: 24 },
        { task: "Test5", done: false, id: 25 },
        { task: "Test6", done: false, id: 26 },
        { task: "Test7", done: false, id: 27 },
        { task: "Test8", done: false, id: 28 },
        { task: "Test9", done: false, id: 29 },
        { task: "Test10", done: false, id: 30 },
      ];
      const shuffledEasyTasks = easyTasks.sort(() => 0.5 - Math.random());
      const shuffledMediumTasks = mediumTasks.sort(() => 0.5 - Math.random());
      const shuffledHardTasks = hardTasks.sort(() => 0.5 - Math.random());
      const allPlayers = await playersRef.where("role", "!=", "dq").get();
      var imposters = 4;
      allPlayers.forEach((doc) => {
        batch.update(allPlayersRef.doc(doc.id), {
          inGame: doc.data().ready,
          role:
            doc.data().role === "admin"
              ? "admin"
              : imposters > 0
              ? "imposter"
              : "crewmate",
          easyTasks: shuffledEasyTasks.slice(0, 3),
          mediumTasks: shuffledMediumTasks.slice(0, 2),
          hardTasks: shuffledHardTasks.slice(0, 1),
        });
        if (doc.data().role !== "admin") imposters--;
      });
      await batch.commit();
      setGameStarted(true);
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
            <Button
              mt={4}
              colorScheme="blue"
              isLoading={gameStarting}
              onClick={startGame}
            >
              Pradėti žaidimą
            </Button>
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
            value={(doneTasks() / ((players.length - 7) * 10)) * 100}
            borderRadius="5px"
            mb={2}
          />
          {currentPlayer.role === "crewmate" ? (
            <Button colorScheme="blue" width="100%" my={3}>
              Šaukti susirinkimą
            </Button>
          ) : currentPlayer.role === "imposter" ? (
            <Button colorScheme="red" width="100%" my={3}>
              Sabotažas
            </Button>
          ) : (
            ""
          )}
          {currentPlayer.role === "crewmate" ? (
            <>
              <Text fontWeight="600" fontSize="30px">
                Mano užduotys:
              </Text>
              <Text fontWeight="500" fontSize="16px">
                Lengvos užduotys:
              </Text>
              <OrderedList fontSize="14px">
                {currentPlayer.easyTasks.map((task: any) => (
                  <ListItem key={task.id}>
                    <Flex justifyContent="space-between" alignItems="center">
                      <Text>{task.task}</Text>
                      <Text
                        color={task.done ? "black" : "blue.500"}
                        onClick={() => completeEasyTask(task.id)}
                      >
                        {task.done ? "Užduotis atlikta" : "Užduotį atlikau"}
                      </Text>
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
                    <Flex justifyContent="space-between" alignItems="center">
                      <Text>{task.task}</Text>
                      <Text
                        color={task.done ? "black" : "blue.500"}
                        onClick={() => completeMediumTask(task.id)}
                      >
                        {task.done ? "Užduotis atlikta" : "Užduotį atlikau"}
                      </Text>
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
                    <Flex justifyContent="space-between" alignItems="center">
                      <Text>{task.task}</Text>
                      <Text
                        color={task.done ? "black" : "blue.500"}
                        onClick={() => completeHardTask(task.id)}
                      >
                        {task.done ? "Užduotis atlikta" : "Užduotį atlikau"}
                      </Text>
                    </Flex>
                  </ListItem>
                ))}
              </OrderedList>
            </>
          ) : currentPlayer.role === "imposter" ? (
            <>
              <Text fontWeight="600" fontSize="30px">
                Mano netikros užduotys:
              </Text>
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
          ) : (
            ""
          )}
          <Text fontWeight="600" fontSize="30px" mt={6} mb={2}>
            Žaidėjai:
          </Text>
          <PlayerInGame info={currentPlayer} isAdmin={isCurrentPlayerAdmin} />
          {playersInGame &&
            playersInGame.map((player: any, index: number) => {
              if (currentPlayerIndex !== index)
                return (
                  <PlayerInGame
                    key={player.id}
                    info={player}
                    isAdmin={isCurrentPlayerAdmin}
                  />
                );
            })}
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
  const { name, uid, isDead } = props.info;
  const playersRef = firestore.collection("players");
  const currentPlayerRef = playersRef.doc(auth.currentUser?.uid);
  const [currentPlayer]: any = useDocument(currentPlayerRef);
  const kickPlayer = async (uid: string) => {
    const playerRef = firestore.collection("players").doc(uid);
    await playerRef.update({
      inGame: false,
      ready: false,
      role: "dq",
      screenHidden: false,
    });
  };
  return (
    <>
      <Flex alignItems="center" justifyContent="space-between" mb={2}>
        <Text fontWeight={auth.currentUser?.uid === uid ? "600" : "400"}>
          {name}
        </Text>
        {auth.currentUser?.uid !== uid &&
          (currentPlayer?.data().role === "crewmate" ? (
            <Text color="blue.600">Pranešti apie mirusį</Text>
          ) : currentPlayer?.data().role === "admin" ? (
            <Text color="green.600" onClick={() => kickPlayer(uid)}>
              Diskvalifikuoti žaidėją
            </Text>
          ) : isDead ? (
            <Text color="red.600">Žaidėjas miręs</Text>
          ) : (
            <Text color="red.600">Nužudyti</Text>
          ))}
      </Flex>
    </>
  );
}

export default App;
