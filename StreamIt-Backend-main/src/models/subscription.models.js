import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
    //who are subscribing
    subscriber :{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    },
    //to whom we are subscribing
    channel: {
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    }
},{timestamps:true})

export const Subscription = mongoose.model("Subscription",subscriptionSchema)


//if how many subscribers to a channel - i will count the no of matches i find to the channel in documents
//if how many channels subscriber by a subscriber - i will count the no of matches i find to that  subscriber in documents