import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

    const { fullName, username, email, password, avatar } = req.body;
    console.log("email ", email);
    if (
        [fullName, username, email, password, avatar].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "Please provide all the fields");
    }
    const existedUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existedUser) {
        throw new ApiError(409, "User already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Please provide avatar");
    }
    const avatarCloudinary = await uploadOnCloudinary(avatarLocalPath);
    const coverImageCloudinary = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatarCloudinary) {
        throw new ApiError(400, "Avatar upload failed");
    }
    const user = await User.create({
        fullName,
        avatar: avatarCloudinary.url,
        coverImage: coverImageCloudinary?.url || "",
        username: username.toLowerCase(),
        email,
        password,
    });
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while creating user");
    }

    return res.status(201).json(new ApiResponse(200,createdUser,"User created successfully"));
});

export { registerUser };
