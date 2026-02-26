from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database import get_db
from app import models, schemas
from app.auth import (
    hash_password, verify_password, create_access_token, get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
users_router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/register", response_model=schemas.Token)
async def register(data: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    # check duplicates
    result = await db.execute(
        select(models.User).where(
            or_(models.User.email == data.email, models.User.username == data.username)
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already taken")

    user = models.User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
        avatar_url=data.avatar_url or f"https://api.dicebear.com/7.x/avataaars/svg?seed={data.username}",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))


@router.post("/login", response_model=schemas.Token)
async def login(data: schemas.UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.User).where(models.User.email == data.email)
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id)})
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))


@users_router.get("/me", response_model=schemas.UserOut)
async def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@users_router.patch("/profile", response_model=schemas.UserOut)
async def update_profile(
    data: schemas.UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if data.username:
        current_user.username = data.username
    if data.avatar_url:
        current_user.avatar_url = data.avatar_url
    if data.about:
        current_user.about = data.about
    
    await db.commit()
    await db.refresh(current_user)
    return current_user


@users_router.get("/search", response_model=list[schemas.UserOut])
async def search_users(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = await db.execute(
        select(models.User).where(
            models.User.username.ilike(f"%{q}%"),
            models.User.id != current_user.id,
        ).limit(20)
    )
    return result.scalars().all()
