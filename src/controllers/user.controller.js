import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

const generateAccessAndRefreshToken = async (userId) => {
    
    try {
       const user = await User.findById(userId);
       const accessToken = user.generateAccessToken();
       const refreshToken = user.generateAccessToken();

       user.refreshToken = refreshToken;
       user.save({ validateBeforeSave : false})

       return {accessToken, refreshToken}
        
    } catch (error) {
        throw new ApiError(500 , "Something went wrong while generating access and refresh token.", error)
    }
   
}

// Register user...
const registerUser = asyncHandler ( async ( req, res) => {
  

    // 1. get the use details from  the frontend 
    // 2. validation - not empty
    // 3. check if user already exists : username, email
    // 4. check for images, check for avatar
    // 5. upload them to cloudinary, avatar
    // 6. create user object - create entry in db
    // 7. rm password and refresh token from the body
    // return res
    

    //1. get the use details from  the frontend 
    const { fullName, email , username, password} = req.body;
      
    //2. validation - for not empty
    if(
       [fullName, email, username, password].some( (field) => 
       field?.trim()==="")
    ) {
       throw new ApiError(500, "All field are required !!")
    }
    // if(fullName === "") throw new ApiError(500, "fullName is required !!")
      
    //3.check if user already exists : username, email
        const existingUser = await User.findOne({
            $or : [{ username }, { email}]
        })

        if(existingUser) {
            throw new ApiError(409, "User with email or username is  already exists !!")
        }

     // 4. check for images, check for avatar
       
        const avatarLocalPath = req.files?.avatar[0]?.path;
        // const coverImageLocalPath = req.files?.coverImage[0]?.path;

        let coverImageLocalPath;
        if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
            coverImageLocalPath = req.files.coverImage[0].path
        }

        if(!avatarLocalPath) {
            throw new ApiError(400 , "Avatar is required !!!")
        }
        
    // 5. upload them to cloudinary, avatar

        const avatar = await uploadOnCloudinary(avatarLocalPath)
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)
         
        if(!avatar) {
            throw new ApiError(400, "Failed to upload avatar to cloudinary")
        }
     
    // 6. create user object - create entry in db
       
       const createdUser = await User.create({
        fullName,
        email,
        password,
        username : username.toLowerCase(),
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
       })
       
    // 7. rm password and refresh token from the body
       User.findById(User._id).select(
        "-password -refreshToken"
       )

       if (!createdUser) {
         throw new ApiError(500, "Something went wrong while registering the user")
       }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

})


// Login user...
const loginUser = asyncHandler(  async (req, res) => {
   // data from req body 
   // email or password
   // find the  user
   // check the  password

   // access and refresh token
   // send cookie

   const { email, username, password } = req.body;
   
   if(!username || !email) {
      throw new ApiError(400, "username or email is required!!")
   }

   const user = await User.findOne({
    $or : [ {username}, {email}]
   })

   if(!user) {
     throw new ApiError( 404, "User does not exist");
   }
   
   const isValidPassword = await user.isPasswordCorrect(password);
   if(!isValidPassword){
        throw new ApiError(401, "Invalid password !!!")
   }

   const { accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);
   const loggedInUser = await User.findById(user._id).select(" -password -refreshToken ");

   // for cookies
    const options = {
        httpOnly : true,  // now only modifiable by server
        secure : true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            { 
                 user : loggedInUser, accessToken, refreshToken
            }, 
            "User logged in Successfully"
        )
    )


})


//Logout User... 
const logOutUser = asyncHandler( async(req, res) => {
     
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                refreshToken : null
            }
        }, 
        {
            new : true
        }
    )

    const options = {
        httpOnly : true,  // now only modifiable by server
        secure : true
    }

    return res
    .status(200)
    .clearCookie("accessToken", accessToken, options)
    .clearCookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse( 200 , {}, "User Logged Out !!")
    )
})

export { registerUser, loginUser, logOutUser};