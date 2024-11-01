import FormData from "form-data";
import fs from "node:fs";
import sharp from "sharp";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { MessageType } from "../models/Message.js";
import { apiFactory, encodeAES, makeURL, request } from "../utils.js";

export type ForwardResult = {
    clientId: string;
    msgId: string;
};

export type ForwardResponse = {
    success: ForwardResult[] | null;
};

export type MessageInfo = {
    message: string;
};

export type AttachmentInfo = {
    url: string;
    fileName: string;
    extension: string;
    checksum: string;
    size: string;
    fType: number;
    fdata: string;
};

export const forwardFactory = apiFactory<ForwardResponse>()((api, ctx, resolve) => {
    const serviceURLs = {
        message: {
            [MessageType.DirectMessage]: makeURL(`${api.zpwServiceMap.file[0]}/api/message/mforward`, {
                nretry: 0,
            }),
            [MessageType.GroupMessage]: makeURL(`${api.zpwServiceMap.file[0]}/api/group/mforward`, {
                nretry: 0,
            })
        },
        attachment: {
            [MessageType.DirectMessage]: makeURL(`${api.zpwServiceMap.file[0]}/api/message/forward`, {
                nretry: 0,
            }),
            [MessageType.GroupMessage]: makeURL(`${api.zpwServiceMap.file[0]}/api/group/forward`, {
                nretry: 0,
            })
        }
    };

    function isMessageInfo(info: MessageInfo | AttachmentInfo): info is MessageInfo {
        return (info as MessageInfo).message !== undefined;
    }

    /**
     * Forward message
     *
     * @param toIds List of target id
     *
     * @param type Send to group & direct user
     *
     * @param msgInfo List of target id
     *
     * @throws ZaloApiError
     */
    return async function forwardMessage(toIds: string[], type: MessageType, msgInfo: MessageInfo | AttachmentInfo) {
        if (!toIds) throw new ZaloApiError("Missing toIds");

        const params: any = {
            ttl: 0,
            msgType: "1",
            totalIds: toIds.length,
            msgInfo: JSON.stringify(msgInfo),
        };

        if (type === MessageType.DirectMessage) {
            params.toIds = toIds.map((x) => ({
                clientId: new Date().getTime(),
                toUid: x,
                ttl: 0,
            }));
            params.imei = ctx.imei;
        } else if (type === MessageType.GroupMessage) {
            params.grids = toIds.map((x) => ({
                clientId: new Date().getTime().toString(),
                grid: x,
                ttl: 0,
            }));
        }

        const encryptedParams = encodeAES(ctx.secretKey, JSON.stringify(params));
        if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");
        console.log(isMessageInfo(msgInfo) ? serviceURLs.message : serviceURLs.attachment);
        console.log(params);
        const response = await request(
            isMessageInfo(msgInfo) ? serviceURLs.message[type] : serviceURLs.attachment[type],
            {
                method: "POST",
                body: new URLSearchParams({
                    params: encryptedParams,
                })
            }
        );

        return resolve(response, (result) => {
            if (result.error && result.error.code != 216)
                throw new ZaloApiError(result.error.message, result.error.code);

            return result.data as ForwardResponse;
        });
    };
});
