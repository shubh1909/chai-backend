import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAcessTokenAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken; //refreshToken is a property of user object and we are updating it
        await user.save({ validateBeforeSave: false });
        //save user object to db and we used validateBeforeSave to false because we dont want to validate the data before saving it
        // as we had the password validation method in the pre save hook

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating refresh and access token"
        );
    }
};
const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation : field not empty
    // check if user already exists in db : username and email
    // check for images and check for avatar
    // upload images on cloudinary , avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const { fullName, username, email, password, avatar } = req.body; // destructuring // req.body is the request body
    console.log("request body :  ", req.body);
    if (
        [fullName, username, email, password, avatar].some(
            (field) => field?.trim() === ""
        ) // .trim() removes the white space from the start and end of the string and some() is a method that returns true if at least one of the elements in the array is true
    ) {
        throw new ApiError(400, "Please provide all the fields");
    } // if any field is empty then throw error
    // check if user already exists in db : username and email
    const existedUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existedUser) {
        throw new ApiError(409, "User already exists");
    }
    // check for images and check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path; // req.files is the files that are uploaded by the user an this is needed because we are using multer middleware
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    console.log("req.files data : ", req.files);

    if (!avatarLocalPath) {
        throw new ApiError(400, "Please provide avatar");
    }
    const avatarCloudinary = await uploadOnCloudinary(avatarLocalPath); //uploadOnCloudinary is a function that is imported from cloudinary.js
    const coverImageCloudinary = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatarCloudinary) {
        throw new ApiError(400, "Avatar upload failed");
    } //if avatar upload fails
    const user = await User.create({
        fullName,
        avatar: avatarCloudinary.url,
        coverImage: coverImageCloudinary?.url || "",
        username: username.toLowerCase(),
        email,
        password,
    }); //create user object
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    ); //-password -refreshToken means exclude password and refreshToken field from response
    // check for user creation and return response
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while creating user");
    }

    return res
        .status(201)
        .json(new ApiResponse(200, createdUser, "User created successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
    // get user details from frontend (request body)
    // check if user exists in db : username and email
    // find the user in db
    // check if password is correct
    // is password is incorrect then throw error
    // generate access token
    // generate refresh token
    // send them through cookies
    // return response

    const { email, username, password } = req.body; // destructuring // req.body is the request body
    if (!username && !email) {
        throw new ApiError(400, "Username or email is required");
    }

    const user = await User.findOne({ $or: [{ email }, { username }] });
    if (!user) {
        throw new ApiError(404, "User dosn't exist");
    }

    // user and User are different because User is the entity used for accessing the functions of mongoDB wheareas
    // user is the object we created or the instance created by us so dont confuse them
    const isPasswordValid = await user.isPasswordCorrect(password); // isPasswordCorrect is a method that is defined in user.model.js
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } =
        await generateAcessTokenAndRefreshToken(user._id); // generateTokens is a function that is defined in user.controller.js
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    const options = {
        httpOnly: true,
        secure: true,
    };
    // send them through cookies
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, refreshToken, accessToken },
                "User logged in successfully"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: { refreshToken: 1 }, // $unset removes the refreshToken field from the user document
        },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies?.refreshToken || req.body?.refreshToken;
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);
        if (!user) {
            throw new ApiError(401, "Invaild refresh token");
        }

        if (user?.refreshToken !== incomingRefreshToken) {
            throw new ApiError(401, "Refresh token is expired or used .");
        }

        options = {
            httpOnly: true,
            secure: true,
        };

        const { newAccessToken, newRefreshToken } =
            await generateAcessTokenAndRefreshToken(user._id);
        // generateTokens is a function that is defined in user.controller.js

        return res
            .status(200)
            .cookie("accessToken", newAccessToken, options)
            .ccokie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken: newAccessToken,
                        refreshToken: newAccessToken,
                    },
                    "Tokens refreshed successfully"
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);
    if (!isPasswordCorrect) {
        throw new ApiError(401, "Password is invalid");
    }
    user.password = newPassword;
    await user.save({ validation: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(200, req.user, "Current  User fetched successfully")
        );
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;
    if (!fullName || !email) {
        throw new ApiError(400, "Full name and email are required");
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email,
            },
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Account details updated successfully")
        );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing.");
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar.url) {
        throw new ApiError(500, "Error uploading avatar to cloudinary");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url,
            },
        },
        { new: true }
    ).select(" -password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Avatar file is missing.");
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage.url) {
        throw new ApiError(500, "Error uploading cover image to cloudinary");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url,
            },
        },
        { new: true }
    ).select(" -password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Cover Image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;
    if (!username?.trim()) {
        throw new ApiError(400, "Username is missing");
    }

    const channel = await User.aggregate([
        {
            $match: { username: username?.toLowerCase() },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo",
            },
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers",
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo",
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] }, // if subscriber is in subscribers array
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                subscriberCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                email: 1,
            },
        },
    ]);
    console.log(channel);
    if (!channel.length) {
        throw new ApiError(404, "Channel not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                channel[0],
                "Channel profile fetched successfully"
            )
        );
});

const getUserWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(req.user?._id) },
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner",
                            },
                        },
                    },
                ],
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0].watchHistory,
                "Watch History fetched successfully"
            )
        );
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getUserWatchHistory,
};
