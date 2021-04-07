require('dotenv').config();
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const typeDefs = require('./schema');
const resolvers = require('./resolvers');
const { createStore } = require('./utils');
const isEmail = require('isemail');

const LaunchAPI = require('./datasources/launch');
const UserAPI = require('./datasources/user');
const path = require('path');

async function startApolloServer() {
  const app = express();
  const store = createStore();

  const server = new ApolloServer({
    context: async ({ req }) => {
      // simple auth check on every request
      const auth = (req.headers && req.headers.authorization) || '';
      const email = Buffer.from(auth, 'base64').toString('ascii');
      if (!isEmail.validate(email)) return { user: null };
      // find a user by their email
      const users = await store.users.findOrCreate({ where: { email } });
      const user = (users && users[0]) || null;
      return { user: { ...user.dataValues } };
    },
    typeDefs,
    resolvers,
    dataSources: () => ({
      launchAPI: new LaunchAPI(),
      userAPI: new UserAPI({ store }),
    }),
  });

  await server.start();

  server.applyMiddleware({ app });

  app.use(express.static('public'));

  app.use((req, res) => {
    res.status(200);
    res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
    res.end();
  });

  const PORT = process.env.PORT || 4000;

  await new Promise((resolve) => app.listen({ port: PORT }, resolve));
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
  return { server, app };
}
startApolloServer();
