import { Request } from 'express';
import { User, AgentProfile, ClinicProfile } from '@prisma/client';

export interface AuthRequest extends Request {
  user: User;
}

export interface AgentRequest extends AuthRequest {
  agentProfile: AgentProfile;
}

export interface ClinicRequest extends AuthRequest {
  clinicProfile: ClinicProfile;
}
