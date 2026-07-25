const replicaSetConfig = {
    _id: "rs0",
    members: [{ _id: 0, host: "mongodb:27017" }],
};

const initializeReplicaSet = () => {
    try {
        rs.status();
    } catch (error) {
        if (error.codeName !== "NotYetInitialized") {
            throw error;
        }
        rs.initiate(replicaSetConfig);
    }
};

const waitForPrimary = () => {
    const deadline = Date.now() + 60_000;
    while (!db.hello().isWritablePrimary) {
        if (Date.now() >= deadline) {
            throw new Error("MongoDB replica set did not elect a primary within 60 seconds");
        }
        sleep(1_000);
    }
};

const configureMongotUser = () => {
    const adminDatabase = db.getSiblingDB("admin");
    const username = process.env.MONGOT_USERNAME;
    const password = process.env.MONGOT_PASSWORD;
    if (!username || !password) {
        throw new Error("MONGOT_USERNAME and MONGOT_PASSWORD are required");
    }

    if (adminDatabase.getUser(username)) {
        adminDatabase.updateUser(username, {
            pwd: password,
            roles: ["searchCoordinator"],
        });
        return;
    }

    adminDatabase.createUser({
        user: username,
        pwd: password,
        roles: ["searchCoordinator"],
    });
};

initializeReplicaSet();
waitForPrimary();
configureMongotUser();
