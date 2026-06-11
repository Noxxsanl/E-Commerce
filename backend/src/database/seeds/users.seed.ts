import { Connection } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  UserRole,
  UserStatus,
  UserSchema,
} from '../../modules/users/schemas/user.schema';

const BCRYPT_ROUNDS = 12;

const usersData = [
  {
    fullName: 'Super Admin',
    email: 'superadmin@ecommerce.com',
    password: 'SuperAdmin@123',
    role: UserRole.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
    isEmailVerified: true,
    phone: '0900000001',
  },
  {
    fullName: 'Admin',
    email: 'admin@ecommerce.com',
    password: 'Admin@123',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    isEmailVerified: true,
    phone: '0900000002',
  },
  {
    fullName: 'Moderator',
    email: 'moderator@ecommerce.com',
    password: 'Moderator@123',
    role: UserRole.MODERATOR,
    status: UserStatus.ACTIVE,
    isEmailVerified: true,
    phone: '0900000003',
  },
  {
    fullName: 'Nguyễn Văn A',
    email: 'user1@ecommerce.com',
    password: 'User@123456',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isEmailVerified: true,
    phone: '0900000004',
  },
  {
    fullName: 'Trần Thị B',
    email: 'user2@ecommerce.com',
    password: 'User@123456',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isEmailVerified: true,
    phone: '0900000005',
  },
  {
    fullName: 'Lê Văn C',
    email: 'user3@ecommerce.com',
    password: 'User@123456',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isEmailVerified: true,
    phone: '0900000006',
  },
  {
    fullName: 'Phạm Thị D',
    email: 'user4@ecommerce.com',
    password: 'User@123456',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isEmailVerified: true,
    phone: '0900000007',
  },
  {
    fullName: 'Hoàng Văn E',
    email: 'user5@ecommerce.com',
    password: 'User@123456',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isEmailVerified: true,
    phone: '0900000008',
  },
];

export async function seedUsers(connection: Connection): Promise<void> {
  const UserModel = connection.model('User', UserSchema);

  for (const userData of usersData) {
    const existing = await UserModel.findOne({ email: userData.email });
    if (existing) {
      console.log(`[Seed] User already exists: ${userData.email}`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(userData.password, BCRYPT_ROUNDS);
    await UserModel.create({ ...userData, password: hashedPassword });
    console.log(`[Seed] Created user: ${userData.email}`);
  }
}
