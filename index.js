const express = require('express');
const app = express();
var cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Middleware
app.use(cors());
app.use(express.json());



var uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@ac-62j8ihz-shard-00-00.7lbrva6.mongodb.net:27017,ac-62j8ihz-shard-00-01.7lbrva6.mongodb.net:27017,ac-62j8ihz-shard-00-02.7lbrva6.mongodb.net:27017/?ssl=true&replicaSet=atlas-g1t94d-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    
    const userCollections = client.db('DevTalk').collection('users');


    // Users Related API

    app.post('/users', async(req, res) => {
        const user = req.body;

        // find user is exist
        const query = {email: user.email}
        const existingUser = await userCollections.findOne(query);
        if(existingUser){
          return res.send({message: 'user already exist', insertedId: null})
        }

        const result = await userCollections.insertOne(user);
        res.send(result);
    })


    app.get('/users', async(req, res) => {
       const result = await userCollections.find().toArray();
       res.send(result);
    })

    // Admin API
    app.patch('/users/admin/:id', async(req, res) => {
       const id = req.params.id;
       const filter = {_id: new ObjectId(id)}

       const updatedDoc = {
         $set: {
           role: 'admin'
         }
       }
       const result = await userCollections.updateOne(filter, updatedDoc);
       res.send(result);
    })

    app.delete('/users/:id', async(req, res) => {
       const id = req.params.id;
       const filter = {_id: new ObjectId(id)}
       const result = await userCollections.deleteOne(filter);
       res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', async(req, res) => {
    res.send('DavTalk Server is Running')
})

app.listen(port, () => {
    console.log(`DevTalk Server Running On Port ${port}`)
})