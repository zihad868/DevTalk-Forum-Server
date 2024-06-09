const express = require('express');
const app = express();
var cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
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
    const postCollections = client.db('DevTalk').collection('posts');

  

    // JWT Token
    app.post('/jwt', async(req, res) => {
       const user = req.body;
       const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, {expiresIn: '1d'});
       res.send({ token })
    })

    // Verify Token
    const verifyToken = (req, res, next) => {
       console.log('inside verify token', req.headers.authorization);
       
       if(!req.headers.authorization){
         return res.status(401).send({message: 'forbidden access'})
       }
       const token = req.headers.authorization.split(' ')[1];
       
       jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, function(err, decoded) {
          if(err){
            return res.status(401).send({message: 'forbidden access'})
          }
          req.decoded = decoded;
          next();
      });
    }

    // verify admin 
    const verifyAdmin = async (req, res, next) => {
       const email = req.decoded.email;
       const query = {email: email};
       const user = await userCollections.findOne(query);

       const isAdmin = user?.role === 'admin';
       if(!isAdmin){
          return res.status(403).send({message: 'forbidden access'})
       }
       next();
    }

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


    app.get('/users', verifyToken, verifyAdmin, async(req, res) => {
       const result = await userCollections.find().toArray();
       res.send(result);
    })

    app.get('/users/:email', verifyToken, async(req, res) => {
       const email = req.params.email;
       const query = {email: email};
       const user = await userCollections.findOne(query);
       res.send(user);
    })

    // Admin API
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async(req, res) => {
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
    
    // user check admin
    app.get('/users/admin/:email', verifyToken, async(req, res) =>{
       const email = req.params.email;
       if(email !== req.decoded.email){
          return res.status(403).send({message: 'forbidden access'})
       }

       const query = {email: email};
       const user = await userCollections.findOne(query);
       let admin = false;
       if(user){
         admin = user?.role === 'admin';
       }
       res.send({admin})
    })


    app.delete('/users/:id', verifyToken, verifyAdmin, async(req, res) => {
       const id = req.params.id;
       const filter = {_id: new ObjectId(id)}
       const result = await userCollections.deleteOne(filter);
       res.send(result);
    })


    // User Post Related API
    app.post('/post', verifyToken, async(req, res) => {
      const body = req.body;
      const result = await postCollections.insertOne(body);
      res.send(result);
    })


    // Popular Post
    app.get('/posts/popular', async(req, res) => {
       try{
          const popularPost = await postCollections.aggregate([
            {
               $addFields: {
                  voteDifference: { $subtract: ['$upVote', '$downVote']}
               }
            },
            {
               $sort: {voteDifference: -1}
            }
          ]).toArray()
          
         res.send(popularPost);
       }

       catch(error){
         console.log(error);
         return res.status(500).send({message: 'server error'})
       }
    })


    // Get Posts
    app.get('/posts',  async(req, res) => {
       const posts = await postCollections.find().sort({_id: -1}).toArray();
       res.send(posts);
    })

    // Get Post By Email
    app.get('/posts/:email', verifyToken, async(req, res) => {
       const email = req.params.email;
       const query = {authEmail: email}
       const result = await postCollections.find(query).toArray();
       res.send(result);
    })

    app.delete('/posts/:id', verifyToken, async(req, res) => {
       const id = req.params.id;
       const query = {_id: new ObjectId(id)}
       const data = await postCollections.deleteOne(query);
       res.send(data);
    })

    // Get Post By ID
    app.get('/post/:id', verifyToken, async(req, res) => {
       const id = req.params.id;
       const query = {_id: new ObjectId(id)};
       const post = await postCollections.findOne(query);
       res.send(post);
    })

    // UpVote
    app.post('/post/upvote/:id', async(req, res) => {
       const id = req.params.id;
       const query = {_id: new ObjectId(id)};
       const updatedDoc = {
         $inc: {upVote: 1}
       }

       const update = await postCollections.updateOne(query, updatedDoc);
       res.send(update);
    })

    // Down Vote
    app.post('/post/downvote/:id', async(req, res) => {
       const id = req.params.id;
       const query = {_id: new ObjectId(id)};
       const updatedDoc = {
         $inc: {downVote: 1}
       }
       const update = await postCollections.updateOne(query, updatedDoc);
       res.send(update);
    })

    //Stripe Payment Intent 
    app.post('/create-payment-intent', async(req, res) => {
       const {price} = req.body;
       const amount = parseInt(price*100);

       const paymentIntent = await stripe.paymentIntents.create({
         amount: amount,
         currency: "usd",
         payment_method_types: ['card']
       })

       res.send({
         clientSecret: paymentIntent.client_secret
       })
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