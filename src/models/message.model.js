import mongoose, { Schema } from "mongoose";


const messageSchema = new Schema({
    content: {
        text: {
            type: String
        },
        file: {
            type: Object
        }
    },
    senderId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    recipientId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    receiveStatus: {
        type: String,
        default: 'un received',
        required: true
    },
    deletedFromSender: {
        type: Boolean,
        default: false
    },
    deletedFromRecipient: {
        type: Boolean,
        default: false
    }
}, { timestamps: true })

export const Message = mongoose.model("Message", messageSchema)


