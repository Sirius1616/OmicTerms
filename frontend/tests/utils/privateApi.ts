// Note: the `PrivateService` is only available when generating the client
// for local environments
import {
  AuthService,
  OpenAPI,
  type PrivateCreateUserData,
  PrivateService,
} from "../../src/client"
import { firstSuperuser, firstSuperuserPassword } from "../config"

OpenAPI.BASE = `${process.env.VITE_API_URL}`

let adminToken: string | undefined

// The private helper router is admin-only, so authenticate as the seeded
// superuser before creating a test user.
const authenticateAsAdmin = async (): Promise<string> => {
  if (!adminToken) {
    const { access_token } = await AuthService.loginAccessToken({
      formData: {
        username: firstSuperuser,
        password: firstSuperuserPassword,
      },
    })
    adminToken = access_token
  }
  return adminToken
}

export const createUser = async ({
  email,
  password,
  is_active = true,
}: {
  email: string
  password: string
  is_active?: boolean
}) => {
  const token = await authenticateAsAdmin()
  OpenAPI.TOKEN = token
  try {
    const requestBody: PrivateCreateUserData["requestBody"] = {
      email,
      password,
      full_name: "Test User",
      is_active,
    }
    return await PrivateService.createUser({ requestBody })
  } finally {
    OpenAPI.TOKEN = undefined
  }
}
